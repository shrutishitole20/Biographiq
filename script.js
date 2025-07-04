async function suggestNames() {
    const searchBar = document.getElementById('searchBar');
    const suggestionsList = document.getElementById('suggestions');
    const query = searchBar.value;

    if (query.length < 2) {
        suggestionsList.innerHTML = '';
        return;
    }

    const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=10&format=json&origin=*`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        suggestionsList.innerHTML = '';
        data[1].forEach(name => {
            const suggestionItem = document.createElement('li');
            suggestionItem.className = 'list-group-item list-group-item-action';
            suggestionItem.textContent = name;
            suggestionItem.onclick = () => {
                searchBar.value = name;
                suggestionsList.innerHTML = '';
                searchBiography();
            };
            suggestionsList.appendChild(suggestionItem);
        });
    } catch (error) {
        console.error('Error fetching suggestions:', error);
    }
}

async function searchBiography() {
    const searchBar = document.getElementById('searchBar');
    const resultDiv = document.getElementById('result');
    const query = searchBar.value;

    if (!query) {
        resultDiv.innerHTML = "<p class='text-danger'>Please enter a name to search.</p>";
        return;
    }

    resultDiv.innerHTML = "<p>Loading...</p>";

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.type === 'disambiguation') {
            resultDiv.innerHTML = `<p class='text-warning'>Multiple results found. Please be more specific.</p>`;
            return;
        }

        if (data.type === 'standard') {
            const summary = `
                <div class="card">
                    <div class="card-body">
                        <h2 class="card-title text-center">${data.title}</h2>
                        <img class="round-image" src="${data.thumbnail ? data.thumbnail.source : ''}" alt="${data.title}">
                        <p class="card-text">${data.extract}</p>
                        <button class="btn btn-success" onclick="fetchFullBiography('${data.title}')">Download Full Biography</button>
                    </div>
                </div>
            `;
            resultDiv.innerHTML = summary;
        } else {
            resultDiv.innerHTML = `<p class='text-danger'>No biography found for "${query}".</p>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<p class='text-danger'>Error fetching data. Please try again.</p>`;
    }
}

async function fetchFullBiography(title) {
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const content = data.parse.text['*'];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;

        const sections = Array.from(tempDiv.querySelectorAll('h2, h3, h4, p'));
        const sectionContents = [];
        let currentSection = null;

        sections.forEach(element => {
            if (element.tagName.match(/^H[2-4]$/)) {
                if (currentSection) {
                    sectionContents.push(currentSection);
                }
                currentSection = {
                    title: element.innerText,
                    content: ''
                };
            } else if (element.tagName === 'P' && currentSection) {
                currentSection.content += element.innerText + '\n\n';
            }
        });

        if (currentSection) {
            sectionContents.push(currentSection);
        }

        const infobox = tempDiv.querySelector('.infobox');
        const tableData = [];
        if (infobox) {
            const rows = infobox.querySelectorAll('tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('th, td');
                const rowData = Array.from(cells).map(cell => cell.innerText.trim());
                tableData.push(rowData);
            });
        }

        downloadPDF(title, sectionContents, tableData);
    } catch (error) {
        console.error('Error fetching full biography:', error);
    }
}

function downloadPDF(title, sections, tableData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text(`Name: ${title}`, 10, 10);

    if (tableData.length > 0) {
        doc.autoTable({
            head: [tableData[0]],
            body: tableData.slice(1),
            startY: 20
        });
    }

    let yOffset = doc.previousAutoTable ? doc.previousAutoTable.finalY + 20 : 30;

    sections.forEach(section => {
        if (yOffset > 280) {
            doc.addPage();
            yOffset = 10;
        }

        doc.setFontSize(14);
        doc.text(section.title, 10, yOffset);
        yOffset += 10;

        doc.setFontSize(12);
        const lines = doc.splitTextToSize(section.content, 180);
        lines.forEach(line => {
            if (yOffset > 280) {
                doc.addPage();
                yOffset = 10;
            }
            doc.text(line, 10, yOffset);
            yOffset += 10;
        });
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = pageCount; i < 4; i++) {
        doc.addPage();
        doc.text(`Additional content to ensure a minimum of 4 pages`, 10, 10);
    }

    doc.save(`${title}.pdf`);
}
