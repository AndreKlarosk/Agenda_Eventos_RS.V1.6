document.addEventListener('DOMContentLoaded', () => {
    // ELEMENTOS DO DOM
    const monthYearStr = document.getElementById('month-year-str');
    const calendarDays = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // NEW DATE RANGE INPUTS
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');

    // ELEMENTOS DO MODAL
    const eventModal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const eventIdInput = document.getElementById('event-id');
    const eventTitleInput = document.getElementById('event-title-input'); // General title, now optional
    const eventDescInput = document.getElementById('event-desc-input');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const closeBtn = document.querySelector('.close-btn');
    const eventHourInput = document.getElementById('event-hour-input');

    // NEW DOM ELEMENTS FOR EVENT TYPES AND CONDITIONAL INPUTS
    const eventTypeSelect = document.getElementById('event-type-select');
    const reuniaoOptionsDiv = document.getElementById('reuniao-options');
    const batismoMocidadeOptionsDiv = document.getElementById('batismo-mocidade-options');
    const ensaioRegionalOptionsDiv = document.getElementById('ensaio-regional-options');
    const ensaioLocalOptionsDiv = document.getElementById('ensaio-local-options');

    const ancientsNameInput = document.getElementById('ancients-name-input');
    const cityInputBM = document.getElementById('city-input-bm');
    const ancientsNameERInput = document.getElementById('ancients-name-er-input');
    const regionalManagerInput = document.getElementById('regional-manager-input');
    const cityInputER = document.getElementById('city-input-er');
    const localManagerInput = document.getElementById('local-manager-input');
    const cityInputEL = document.getElementById('city-input-el');

    // NEW CHECKBOXES
    const participantCheckboxes = document.querySelectorAll('input[name="event-participant"]');
    const reuniaoTypeCheckboxes = document.querySelectorAll('input[name="reuniao-type"]'); // For RMA, RRM, etc.

    // ESTADO DO CALENDÁRIO
    let currentDate = new Date();
    let db;
    let selectedDate;

    // INICIALIZAÇÃO DO INDEXEDDB
    function initDB() {
        const request = indexedDB.open('agendaDB', 1);

        request.onerror = (event) => console.error("Erro no IndexedDB:", event.target.errorCode);

        request.onsuccess = (event) => {
            db = event.target.result;
            renderCalendar();
            // Set default dates for the report to current year
            const today = new Date();
            startDateInput.value = `${today.getFullYear()}-01-01`;
            endDateInput.value = `${today.getFullYear()}-12-31`;
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore('events', { keyPath: 'id' });
        };
    }

    // RENDERIZAÇÃO DO CALENDÁRIO
    async function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        monthYearStr.textContent = `${new Date(year, month).toLocaleString('pt-br', { month: 'long' })} ${year}`;
        calendarDays.innerHTML = '';

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const events = await getEventsForMonth(year, month);

        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('day', 'empty');
            calendarDays.appendChild(emptyDay);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const daySquare = document.createElement('div');
            daySquare.classList.add('day');
            daySquare.textContent = day;
            daySquare.dataset.date = new Date(year, month, day).toISOString().split('T')[0];

            const today = new Date();
            if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
                daySquare.classList.add('today');
            }

            const dateStr = daySquare.dataset.date;
            if (events.some(e => e.id.startsWith(dateStr))) {
                const eventIndicator = document.createElement('div');
                eventIndicator.classList.add('event-indicator');
                daySquare.appendChild(eventIndicator);
            }

            daySquare.addEventListener('click', () => openModal(daySquare.dataset.date));
            calendarDays.appendChild(daySquare);
        }
    }

    function showConditionalInputs(eventType) {
        // Hide all conditional divs first
        reuniaoOptionsDiv.style.display = 'none';
        batismoMocidadeOptionsDiv.style.display = 'none';
        ensaioRegionalOptionsDiv.style.display = 'none';
        ensaioLocalOptionsDiv.style.display = 'none';
        eventTitleInput.style.display = 'none'; // Hide general title by default

        // Show specific divs based on event type
        if (eventType === 'Reunião') {
            reuniaoOptionsDiv.style.display = 'block';
        } else if (eventType === 'Batismo' || eventType === 'Reunião para Mocidade') {
            batismoMocidadeOptionsDiv.style.display = 'block';
        } else if (eventType === 'Ensaio Regional') {
            ensaioRegionalOptionsDiv.style.display = 'block';
        } else if (eventType === 'Ensaio Local') {
            ensaioLocalOptionsDiv.style.display = 'block';
        } else if (eventType === '') { // No event type selected or default
             eventTitleInput.style.display = 'block'; // Show general title input
        }
    }

    async function openModal(date) {
        selectedDate = date;
        resetModal(); // Reset modal first to clear previous state

        const events = await getEventsForDate(date);

        modalTitle.textContent = 'Adicionar Evento';
        eventTypeSelect.value = ''; // Ensure dropdown is reset
        showConditionalInputs(''); // Hide all conditional inputs initially

        const existingList = document.getElementById('event-list');
        if (existingList) existingList.remove();

        if (events.length > 0) {
            const list = document.createElement('ul');
            list.id = 'event-list';
            list.style.marginTop = '15px';

            events.forEach(event => {
                let eventDisplayTitle = event.title || event.eventType; // Use type if no specific title
                if (event.eventType === 'Reunião' && event.reuniaoTypes && event.reuniaoTypes.length > 0) {
                    eventDisplayTitle += ` (${event.reuniaoTypes.join(', ')})`;
                }
                const item = document.createElement('li');
                item.textContent = `${event.hour || '—'} - ${eventDisplayTitle}`;
                item.style.cursor = 'pointer';
                item.style.marginBottom = '5px';
                item.style.borderBottom = '1px solid #ccc';
                item.style.padding = '5px 0';

                item.addEventListener('click', () => {
                    eventIdInput.value = event.id;
                    eventTypeSelect.value = event.eventType || ''; // Set event type dropdown
                    eventTitleInput.value = event.title || ''; // General title

                    showConditionalInputs(event.eventType); // Show/hide inputs based on type

                    eventDescInput.value = event.description || '';
                    eventHourInput.value = event.hour || '';

                    // Populate specific inputs based on event type
                    if (event.eventType === 'Batismo' || event.eventType === 'Reunião para Mocidade') {
                        ancientsNameInput.value = event.ancientsName || '';
                        cityInputBM.value = event.city || '';
                    } else if (event.eventType === 'Ensaio Regional') {
                        ancientsNameERInput.value = event.ancientsName || '';
                        regionalManagerInput.value = event.regionalManager || '';
                        cityInputER.value = event.city || '';
                    } else if (event.eventType === 'Ensaio Local') {
                        localManagerInput.value = event.localManager || '';
                        cityInputEL.value = event.city || '';
                    }

                    // Mark participant checkboxes
                    participantCheckboxes.forEach(checkbox => {
                        checkbox.checked = event.participants && event.participants.includes(checkbox.value);
                    });

                    // Mark reuniao type checkboxes
                    reuniaoTypeCheckboxes.forEach(checkbox => {
                        checkbox.checked = event.reuniaoTypes && event.reuniaoTypes.includes(checkbox.value);
                    });

                    modalTitle.textContent = 'Editar Evento';
                    deleteEventBtn.style.display = 'inline-block';
                });

                list.appendChild(item);
            });

            document.querySelector('.modal-content').appendChild(list);
        }

        eventModal.style.display = 'flex';
    }

    function closeModal() {
        eventModal.style.display = 'none';
        resetModal();
    }

    function resetModal() {
        modalTitle.textContent = 'Adicionar Evento';
        eventIdInput.value = '';
        eventTitleInput.value = '';
        eventDescInput.value = '';
        eventHourInput.value = '';
        eventTypeSelect.value = ''; // Reset event type dropdown

        // Hide all conditional inputs
        showConditionalInputs('');

        // Clear all new input fields
        ancientsNameInput.value = '';
        cityInputBM.value = '';
        ancientsNameERInput.value = '';
        regionalManagerInput.value = '';
        cityInputER.value = '';
        localManagerInput.value = '';
        cityInputEL.value = '';

        // Desmarcar todos os checkboxes de participantes
        participantCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        // Desmarcar todos os checkboxes de tipo de reunião
        reuniaoTypeCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        deleteEventBtn.style.display = 'none';
    }

    function saveEvent() {
        const eventType = eventTypeSelect.value;
        if (!eventType) {
            alert('Por favor, selecione o tipo de evento!');
            return;
        }

        let title = eventTitleInput.value.trim(); // General title, now optional
        const description = eventDescInput.value.trim();
        const eventId = eventIdInput.value || `${selectedDate}-${Date.now()}`;
        const hour = eventHourInput.value;

        // Collect new event-specific data
        let ancientsName = '';
        let city = '';
        let regionalManager = '';
        let localManager = '';
        const reuniaoTypes = [];

        if (eventType === 'Reunião') {
            Array.from(reuniaoTypeCheckboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => reuniaoTypes.push(checkbox.value));
            title = reuniaoTypes.length > 0 ? `Reunião (${reuniaoTypes.join(', ')})` : 'Reunião';
        } else if (eventType === 'Batismo' || eventType === 'Reunião para Mocidade') {
            ancientsName = ancientsNameInput.value.trim();
            city = cityInputBM.value.trim();
            title = eventType; // Set title as event type
        } else if (eventType === 'Ensaio Regional') {
            ancientsName = ancientsNameERInput.value.trim();
            regionalManager = regionalManagerInput.value.trim();
            city = cityInputER.value.trim();
            title = eventType; // Set title as event type
        } else if (eventType === 'Ensaio Local') {
            localManager = localManagerInput.value.trim();
            city = cityInputEL.value.trim();
            title = eventType; // Set title as event type
        }

        // Coletar os participantes selecionados
        const selectedParticipants = Array.from(participantCheckboxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const eventData = {
            id: eventId,
            eventType: eventType, // Store event type
            title: title, // Updated title based on type
            description: description,
            hour: hour,
            participants: selectedParticipants,
            // New fields based on event type
            ancientsName: ancientsName,
            city: city,
            regionalManager: regionalManager,
            localManager: localManager,
            reuniaoTypes: reuniaoTypes // Store selected reunion types
        };

        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        store.put(eventData);

        transaction.oncomplete = () => {
            closeModal();
            renderCalendar();
        };

        transaction.onerror = (event) => console.error("Erro ao salvar evento:", event.target.errorCode);
    }

    function deleteEvent() {
        const eventId = eventIdInput.value;
        if (!eventId) return;

        const transaction = db.transaction(['events'], 'readwrite');
        const store = transaction.objectStore('events');
        store.delete(eventId);

        transaction.oncomplete = () => {
            closeModal();
            renderCalendar();
        };

        transaction.onerror = (event) => console.error("Erro ao deletar evento:", event.target.errorCode);
    }

    async function getEventsForMonth(year, month) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
            const request = store.getAll();

            request.onsuccess = () => {
                const allEvents = request.result;
                const monthEvents = allEvents.filter(e => e.id.startsWith(monthStr));
                resolve(monthEvents);
            };

            request.onerror = (event) => reject("Erro ao buscar eventos:", event.target.errorCode);
        });
    }

    // NEW FUNCTION: Get events for a specific period
    async function getEventsForPeriod(startDate, endDate) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.getAll();

            request.onsuccess = () => {
                const allEvents = request.result;
                const filteredEvents = allEvents.filter(event => {
                    const eventDateStr = event.id.split('-').slice(0, 3).join('-'); // e.g., "2025-01-15"
                    const eventDate = new Date(eventDateStr + 'T00:00:00'); // Ensure date comparison is accurate
                    return eventDate >= startDate && eventDate <= endDate;
                });
                resolve(filteredEvents);
            };

            request.onerror = (event) => reject("Erro ao buscar eventos do período:", event.target.errorCode);
        });
    }


    async function getEventsForDate(dateStr) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['events'], 'readonly');
            const store = transaction.objectStore('events');
            const request = store.getAll();

            request.onsuccess = () => {
                const allEvents = request.result;
                const dateEvents = allEvents.filter(e => e.id.startsWith(dateStr));
                resolve(dateEvents);
            };

            request.onerror = (event) => reject("Erro ao buscar eventos:", event.target.errorCode);
        });
    }

    // Updated exportToPDF to export by period
    async function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('landscape'); // Set orientation to landscape

        const start = startDateInput.value;
        const end = endDateInput.value;

        if (!start || !end) {
            alert('Por favor, selecione as datas de início e fim para o relatório.');
            return;
        }

        const startDate = new Date(start + 'T00:00:00'); // Ensure date comparison is accurate
        const endDate = new Date(end + 'T23:59:59');   // Ensure end of day for comparison

        if (startDate > endDate) {
            alert('A data de início não pode ser posterior à data de fim.');
            return;
        }

        doc.setFontSize(16); // Slightly smaller font for more space
        doc.text(`Relatório de Eventos - Período: ${start} a ${end}`, 14, 22);

        const events = await getEventsForPeriod(startDate, endDate); // Use the new function

        if (events.length === 0) {
            doc.setFontSize(12);
            doc.text(`Nenhum evento agendado para o período de ${start} a ${end}.`, 14, 35);
        } else {
            // Ordena os eventos pela data e depois pela hora
            events.sort((a, b) => {
                const dateA = a.id.split('-').slice(0, 3).join('-');
                const dateB = b.id.split('-').slice(0, 3).join('-');

                if (dateA !== dateB) {
                    return new Date(dateA) - new Date(dateB);
                }
                const hourA = a.hour || '00:00';
                const hourB = b.hour || '00:00';
                return hourA.localeCompare(hourB);
            });

            const tableColumnTitles = ["Data", "Horário", "Tipo de Evento", "Cidade", "Detalhes", "Descrição", "Participantes"];
            const tableBody = events.map(event => {
                const datePart = event.id.split('-').slice(0, 3).join('-');
                const [y, m, d] = datePart.split('-');
                const formattedDate = `${d}/${m}/${y}`;

                let eventDetails = '';
                let city = event.city || ''; // Get city for the dedicated column

                if (event.eventType === 'Reunião' && event.reuniaoTypes && event.reuniaoTypes.length > 0) {
                    eventDetails = `Tipos: ${event.reuniaoTypes.join(', ')}`;
                } else if (event.eventType === 'Batismo' || event.eventType === 'Reunião para Mocidade') {
                    eventDetails = `Ancião: ${event.ancientsName || 'N/A'}`;
                } else if (event.eventType === 'Ensaio Regional') {
                    eventDetails = `Ancião: ${event.ancientsName || 'N/A'}\nEncarregado Regional: ${event.regionalManager || 'N/A'}`;
                } else if (event.eventType === 'Ensaio Local') {
                    eventDetails = `Encarregado Local: ${event.localManager || 'N/A'}`;
                } else if (event.title) {
                    eventDetails = `Título: ${event.title}`;
                } else {
                    eventDetails = 'N/A';
                }

                const participants = event.participants && event.participants.length > 0 ? event.participants.join(', ') : "Nenhum";

                return [
                    formattedDate,
                    event.hour || "—",
                    event.eventType,
                    city, // Dedicated city column
                    eventDetails,
                    event.description || "Sem descrição",
                    participants
                ];
            });

            doc.autoTable({
                head: [tableColumnTitles],
                body: tableBody,
                startY: 30,
                // Adjust column styles for better fit in landscape
                columnStyles: {
                    // Adjust column widths as needed for landscape
                    0: { cellWidth: 25 }, // Data
                    1: { cellWidth: 20 }, // Horário
                    2: { cellWidth: 35 }, // Tipo de Evento
                    3: { cellWidth: 25 }, // Cidade
                    4: { cellWidth: 45 }, // Detalhes (multiline)
                    5: { cellWidth: 'auto', minCellHeight: 15 }, // Descrição (auto width, min height for multiline)
                    6: { cellWidth: 'auto', minCellHeight: 15 }  // Participantes (auto width, min height for multiline)
                },
                didParseCell: function(data) {
                    // This callback helps format cell content before rendering
                    if (data.column.index === 4 && data.cell.raw) { // For 'Detalhes' column
                        data.cell.text = String(data.cell.raw).split('\n'); // Split by newline for multiline content
                    }
                }
            });
        }

        doc.save(`Relatorio_Periodo_${start}_a_${end}.pdf`);
    }

    // EVENT LISTENERS
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == eventModal) closeModal();
    });

    saveEventBtn.addEventListener('click', saveEvent);
    deleteEventBtn.addEventListener('click', deleteEvent);
    exportPdfBtn.addEventListener('click', exportToPDF); // This now calls the updated function

    // Event listener for the new event type dropdown
    eventTypeSelect.addEventListener('change', (event) => {
        showConditionalInputs(event.target.value);
    });

    // INICIALIZAÇÃO
    initDB();
});
document.addEventListener('DOMContentLoaded', () => {
    // ELEMENTOS DO DOM
    const monthYearStr = document.getElementById('month-year-str');
    const calendarDays = document.getElementById('calendar-days');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // ELEMENTOS DO MODAL
    const eventModal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const eventIdInput = document.getElementById('event-id');
    const eventTitleInput = document.getElementById('event-title-input');
    const eventDescInput = document.getElementById('event-desc-input');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const closeBtn = document.querySelector('.close-btn');
    const cityInputReuniao = document.getElementById('city-input-reuniao'); // Novo elemento DOM

    // NOVOS ELEMENTOS DO MODAL PARA PARTICIPANTES
    const participantCheckboxes = document.querySelectorAll('input[name="event-participant"]'); // Seleciona todos os checkboxes de participantes

    // ESTADO DO CALENDÁRIO
    let currentDate = new Date();
    let db;
    let selectedDate;

    // INICIALIZAÇÃO DO INDEXEDDB
    function initDB() {
        const request = indexedDB.open('agendaDB', 1);

        request.onerror = (event) => console.error("Erro no IndexedDB:", event.target.errorCode);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            const objectStore = db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('date', 'date', { unique: false });
            // Adicionar novos índices se necessário, por exemplo, para a cidade
            objectStore.createIndex('city', 'city', { unique: false });
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            renderCalendar();
        };
    }

    // FUNÇÕES DO CALENDÁRIO
    function renderCalendar() {
        calendarDays.innerHTML = '';
        monthYearStr.textContent = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.

        // Preencher dias vazios antes do primeiro dia do mês
        for (let i = 0; i < firstDayOfWeek; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('day', 'empty');
            calendarDays.appendChild(emptyDay);
        }

        // Preencher os dias do mês
        for (let i = 1; i <= daysInMonth; i++) {
            const day = document.createElement('div');
            day.classList.add('day');
            day.textContent = i;
            day.dataset.date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toISOString().split('T')[0];

            // Adicionar classe para o dia atual
            if (new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toDateString()) {
                day.classList.add('current-day');
            }

            day.addEventListener('click', () => openModal(day.dataset.date));
            calendarDays.appendChild(day);
        }
        loadEventsForMonth();
    }

    function loadEventsForMonth() {
        const transaction = db.transaction(['events'], 'readonly');
        const objectStore = transaction.objectStore('events');
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            const events = event.target.result;
            const days = calendarDays.querySelectorAll('.day:not(.empty)');

            days.forEach(dayElement => {
                const dayDate = dayElement.dataset.date;
                const eventsForDay = events.filter(event => event.date === dayDate);

                // Remover eventos existentes para evitar duplicação
                dayElement.querySelectorAll('.event-marker').forEach(marker => marker.remove());

                if (eventsForDay.length > 0) {
                    const eventMarker = document.createElement('div');
                    eventMarker.classList.add('event-marker');
                    dayElement.appendChild(eventMarker);
                }
            });
        };
    }

    // FUNÇÕES DO MODAL DE EVENTOS
    function openModal(date) {
        selectedDate = date;
        modalTitle.textContent = `Eventos para ${new Date(date).toLocaleDateString('pt-BR')}`;
        eventTitleInput.value = '';
        eventDescInput.value = '';
        eventIdInput.value = '';
        cityInputReuniao.value = ''; // Limpar o campo da cidade
        deleteEventBtn.style.display = 'none';

        // Limpar checkboxes de participantes
        participantCheckboxes.forEach(checkbox => checkbox.checked = false);

        loadEventsForDay(date);
        eventModal.style.display = 'block';
    }

    function closeModal() {
        eventModal.style.display = 'none';
        document.getElementById('event-list').innerHTML = ''; // Limpa a lista de eventos
    }

    function loadEventsForDay(date) {
        const transaction = db.transaction(['events'], 'readonly');
        const objectStore = transaction.objectStore('events');
        const index = objectStore.index('date');
        const request = index.getAll(date);

        request.onsuccess = (event) => {
            const events = event.target.result;
            const eventList = document.getElementById('event-list');
            eventList.innerHTML = ''; // Limpar lista existente

            if (events.length === 0) {
                eventList.innerHTML = '<p>Nenhum evento para este dia.</p>';
                return;
            }

            events.sort((a, b) => a.hour.localeCompare(b.hour)); // Ordenar por horário

            events.forEach(event => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${event.hour} - ${event.title}</strong>
                    <p>${event.description || 'Sem descrição'}</p>
                    <p><small>Cidade: ${event.city || 'Não informada'}</small></p>
                    <small>Participantes: ${event.participants && event.participants.length > 0 ? event.participants.join(', ') : 'Nenhum'}</small>
                `;
                li.addEventListener('click', () => editEvent(event));
                eventList.appendChild(li);
            });
        };
    }

    function saveEvent() {
        const title = eventTitleInput.value.trim();
        const description = eventDescInput.value.trim();
        const hour = document.getElementById('event-hour-input').value; // Novo campo de hora
        const city = cityInputReuniao.value.trim(); // Obter o valor da cidade
        const id = eventIdInput.value;

        if (!title || !hour) { // Validar também a hora
            alert('Por favor, preencha o título e a hora do evento.');
            return;
        }

        const selectedParticipants = Array.from(participantCheckboxes)
                                        .filter(checkbox => checkbox.checked)
                                        .map(checkbox => checkbox.value);

        const event = {
            date: selectedDate,
            title,
            description,
            hour, // Adicionar a hora ao objeto do evento
            city, // Adicionar a cidade ao objeto do evento
            participants: selectedParticipants
        };

        const transaction = db.transaction(['events'], 'readwrite');
        const objectStore = transaction.objectStore('events');

        let request;
        if (id) {
            event.id = parseInt(id);
            request = objectStore.put(event);
        } else {
            request = objectStore.add(event);
        }

        request.onsuccess = () => {
            closeModal();
            renderCalendar();
        };

        request.onerror = (event) => {
            console.error("Erro ao salvar evento:", event.target.errorCode);
        };
    }

    function editEvent(event) {
        eventIdInput.value = event.id;
        eventTitleInput.value = event.title;
        document.getElementById('event-hour-input').value = event.hour; // Preencher a hora
        eventDescInput.value = event.description;
        cityInputReuniao.value = event.city || ''; // Preencher o campo da cidade
        deleteEventBtn.style.display = 'inline-block'; // Mostrar botão de excluir

        // Preencher checkboxes de participantes
        participantCheckboxes.forEach(checkbox => {
            checkbox.checked = event.participants && event.participants.includes(checkbox.value);
        });

        // Rolamos para o topo do modal para a entrada de título ficar visível para edição.
        eventModal.querySelector('.modal-content').scrollTop = 0;
    }

    function deleteEvent() {
        const id = parseInt(eventIdInput.value);
        if (!id) return;

        if (!confirm('Tem certeza que deseja excluir este evento?')) return;

        const transaction = db.transaction(['events'], 'readwrite');
        const objectStore = transaction.objectStore('events');
        const request = objectStore.delete(id);

        request.onsuccess = () => {
            closeModal();
            renderCalendar();
        };

        request.onerror = (event) => {
            console.error("Erro ao excluir evento:", event.target.errorCode);
        };
    }

    // FUNÇÃO DE EXPORTAÇÃO PARA PDF
    function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
        const year = currentDate.getFullYear();
        const reportTitle = `Relatório de Eventos - ${monthName}/${year}`;

        // Add logo (top-left)
        const img = new Image();
        img.src = 'logo-ccb.png'; // Caminho para sua imagem
        img.onload = () => {
            doc.addImage(img, 'PNG', 10, 10, 30, 30); // x, y, width, height

            // Add centered title
            doc.setFontSize(16);
            doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });

            const transaction = db.transaction(['events'], 'readonly');
            const objectStore = transaction.objectStore('events');
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                let allEvents = event.target.result;

                // Filtrar eventos para o mês e ano atuais
                const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
                const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

                const eventsInMonth = allEvents.filter(event =>
                    event.date >= startOfMonth && event.date <= endOfMonth
                );

                // Ordenar eventos por data e depois por hora
                eventsInMonth.sort((a, b) => {
                    if (a.date === b.date) {
                        return a.hour.localeCompare(b.hour);
                    }
                    return a.date.localeCompare(b.date);
                });

                const tableBody = eventsInMonth.map(event => {
                    // Formatar a data para exibição
                    const [y, m, d] = event.date.split('-');
                    const formattedDate = `${d}/${m}/${y}`; // Formato dd/mm/yyyy para o Brasil

                    const participants = event.participants && event.participants.length > 0 ? event.participants.join(', ') : "Nenhum";
                    return [
                        formattedDate,
                        event.hour || "—",
                        event.title,
                        event.description || "Sem descrição",
                        event.city || "Não informada", // Adicionar a cidade
                        participants
                    ];
                });

                doc.autoTable({
                    head: [["Data", "Horário", "Título", "Descrição", "Cidade", "Participantes"]], // Adicionar "Cidade" no cabeçalho
                    body: tableBody,
                    startY: 40 // Ajustar o startY para acomodar a logo e o título
                });

                doc.save(`Relatorio_${monthName}_${year}.pdf`);
            };
        };
        img.onerror = () => {
            console.error("Erro ao carregar a imagem da logo.");
            // Se a imagem não carregar, salve o PDF sem a logo
            doc.setFontSize(16);
            doc.text(reportTitle, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' }); // Still center title
            
            const transaction = db.transaction(['events'], 'readonly');
            const objectStore = transaction.objectStore('events');
            const request = objectStore.getAll();

            request.onsuccess = (event) => {
                let allEvents = event.target.result;
                const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
                const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

                const eventsInMonth = allEvents.filter(event =>
                    event.date >= startOfMonth && event.date <= endOfMonth
                ).sort((a, b) => {
                    if (a.date === b.date) {
                        return a.hour.localeCompare(b.hour);
                    }
                    return a.date.localeCompare(b.date);
                });

                const tableBody = eventsInMonth.map(event => {
                    const [y, m, d] = event.date.split('-');
                    const formattedDate = `${d}/${m}/${y}`;
                    const participants = event.participants && event.participants.length > 0 ? event.participants.join(', ') : "Nenhum";
                    return [
                        formattedDate,
                        event.hour || "—",
                        event.title,
                        event.description || "Sem descrição",
                        event.city || "Não informada",
                        participants
                    ];
                });

                doc.autoTable({
                    head: [["Data", "Horário", "Título", "Descrição", "Cidade", "Participantes"]],
                    body: tableBody,
                    startY: 40 // Adjust startY
                });
                doc.save(`Relatorio_${monthName}_${year}.pdf`);
            };
        };
    }

    // EVENT LISTENERS
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target == eventModal) closeModal();
    });

    saveEventBtn.addEventListener('click', saveEvent);
    deleteEventBtn.addEventListener('click', deleteEvent);
    exportPdfBtn.addEventListener('click', exportToPDF);

    // INICIALIZAÇÃO
    initDB();
});
