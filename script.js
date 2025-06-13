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
