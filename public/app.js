let allExams = [];
let currentView = 'ongoing'; // or 'upcoming'
let countdownIntervals = new Map(); // key: element ID, value: interval ID


async function gettime() {
    try {
        const response = await fetch('http://localhost:3000/api/time');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch time:', error);
        throw error;
    }
}

function formatRemainingTime(ms) {
    if (ms <= 0) return "0s";
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
        days > 0 ? `${days}d :` : '',
        hours > 0 ? `${hours}h :` : '',
        minutes > 0 ? `${minutes}m :` : '',
        `${seconds}s`
    ].filter(Boolean).join(' ');
}

function showNotification(message) {
    playNotificationSound();

    const box = document.getElementById('notificationBox');
    box.textContent = message;
    box.style.display = 'block';
    setTimeout(() => {
        box.style.display = 'none';
    }, 5000);
}


function playNotificationSound() {
    const sound = document.getElementById('notificationSound');
    if (sound) {
        sound.currentTime = 0; // rewind to start
        sound.play().catch(err => console.log("Sound play failed:", err));
    }
}


// API Service Module - Handles all backend communication
const ExamService = {
    /**
     * Fetches all exams from the database
     * @returns {Promise<Array>} Array of exam objects
     */
    getAllExams: async function () {
        try {
            const response = await fetch('http://localhost:3000/api/exams');
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch exams:', error);
            throw error;
        }
    },

    /**
     * Creates a new exam
     * @param {Object} examData - The exam data to create
     * @returns {Promise<Object>} The created exam
     */
    createExam: async function (examData) {
        await fetch('http://localhost:3000/api/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(examData)
        });
    },

    /**
     * Cancels an existing exam
     * @param {string} course - Course name
     * @param {number} examNo - Exam number
     * @param {number} batch - Batch number
     * @returns {Promise<boolean>} True if successful
     */
    cancelExam: async function (course, examNo, batch) {
        try {
            const response = await fetch(
                `http://localhost:3000/api/exams/${encodeURIComponent(course)}/${examNo}/${batch}`,
                { method: 'DELETE' }
            );
            if (!response.ok) throw new Error('Failed to cancel exam');
            return true;
        } catch (error) {
            console.error('Failed to cancel exam:', error);
            throw error;
        }
    },

    /**
     * Reschedules an exam
     * @param {string} course - Course name
     * @param {number} examNo - Exam number
     * @param {number} batch - Batch number
     * @param {string} newDate - New exam date (YYYY-MM-DD)
     * @param {string} newTime - New start time (HH:MM)
     * @returns {Promise<boolean>} True if successful
     */
    rescheduleExam: async function (course, examNo, batch, newDate, newTime) {
        try {
            const response = await fetch(
                `http://localhost:3000/api/exams/${encodeURIComponent(course)}/${examNo}/${batch}/reschedule`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_date: newDate, new_time: newTime })
                }
            );
            if (!response.ok) throw new Error('Failed to reschedule exam');
            return true;
        } catch (error) {
            console.error('Failed to reschedule exam:', error);
            throw error;
        }
    },

    /**
     * Updates exam duration
     * @param {string} course - Course name
     * @param {number} examNo - Exam number
     * @param {number} batch - Batch number
     * @param {number} newDuration - New duration in minutes
     * @returns {Promise<boolean>} True if successful
     */
    updateDuration: async function (course, examNo, batch, newDuration) {
        try {
            const response = await fetch(
                `http://localhost:3000/api/exams/${encodeURIComponent(course)}/${examNo}/${batch}/duration`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ new_duration: parseInt(newDuration) })
                }
            );
            if (!response.ok) throw new Error('Failed to update duration');
            return true;
        } catch (error) {
            console.error('Failed to update duration:', error);
            throw error;
        }
    }
};

// UI Controller - Handles all UI interactions
const ExamController = {




    /**
     * Loads and displays all exams
     */

    loadExams: async function () {
        try {
            const [exams, timeData] = await Promise.all([
                ExamService.getAllExams(),
                gettime()
            ]);

            const now = new Date(timeData);
            console.log("Current Dhaka Time:", now.toISOString());
            const ongoingExams = [];
            const upcomingExams = [];

            for (const exam of exams) {
                try {
                    // Get raw date and time
                    const rawDate = new Date(exam.exam_date); // already parsed as ISO
                    const examDateStr = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`;
                    const startTimeStr = exam.start_time; // e.g., '09:00:00'

                    // Construct exam start in UTC (match backend logic)
                    const examStart = new Date(`${examDateStr}T${startTimeStr}Z`);
                    const examEnd = new Date(examStart.getTime() + exam.duration_minutes * 60000);

                    console.log(`Exam: ${exam.course_name} | Start: ${examStart.toISOString()} | End: ${examEnd.toISOString()} | Now: ${now.toISOString()}`);

                    if (examStart <= now && now <= examEnd) {
                        ongoingExams.push(exam);
                    } else if (examStart > now) {
                        upcomingExams.push(exam);
                    }
                } catch (err) {
                    console.error(`Failed to parse date for ${exam.course_name}:`, err);
                }
            }


            console.log('Current View:', currentView);
            console.log('Ongoing:', ongoingExams.length, 'Upcoming:', upcomingExams.length);

            this.renderExams(currentView === 'ongoing' ? ongoingExams : upcomingExams, timeData);
        } catch (error) {
            console.error('Load exams failed:', error);
            alert('Failed to load exams. Please try again.');
        }
    },



    /**
     * Renders exams to the dashboard
     * @param {Array} exams - Array of exam objects
     */
    renderExams: async function (exams, timeData) {
        const container = document.getElementById('examContainer');
        container.innerHTML = '';

        const now = new Date(timeData);

        exams.forEach(exam => {
            const card = document.createElement('div');
            card.classList.add('exam-card');
            card.dataset.course = exam.course_name;
            card.dataset.exam = exam.exam_no;
            card.dataset.batch = exam.batch;


            const rawDate = new Date(exam.exam_date); // already parsed as ISO
            const examDateStr = `${rawDate.getFullYear()}-${String(rawDate.getMonth() + 1).padStart(2, '0')}-${String(rawDate.getDate()).padStart(2, '0')}`;
            const startTimeStr = exam.start_time; // e.g., '09:00:00'

            // Construct exam start in UTC (match backend logic)
            const examStart = new Date(`${examDateStr}T${startTimeStr}Z`);
            const examEnd = new Date(examStart.getTime() + exam.duration_minutes * 60000);


            const targetTime = currentView === 'ongoing' ? examEnd : examStart;
            const timeLeftId = `time-left-${exam.course_name}-${exam.exam_no}-${exam.batch}`.replace(/\s+/g, '-');


            card.innerHTML = `
            <h2>${exam.course_name}</h2>
            <p><strong>Batch:</strong> ${exam.batch}</p>
            <p><strong>Exam No.:</strong> ${exam.exam_no}</p>
            <p><strong>Date:</strong> ${new Date(exam.exam_date).toLocaleDateString()}</p>
            <p><strong>Start Time:</strong> ${exam.start_time}</p>
            <p><strong>Duration:</strong> ${exam.duration_minutes} minutes</p>
            <p><strong>End Time:</strong> ${exam.finish_time}</p>
            <p class="time-left" id="${timeLeftId}">${formatRemainingTime(targetTime - now)}</p>
            <div class="card-buttons">
                <button class="view-details-btn">View Details</button>
            </div>
        `;
            card.addEventListener('click', () => {
                ExamController.showExamDetails(exam, targetTime);
            });


            container.appendChild(card);

            if (countdownIntervals.has(timeLeftId)) {
                clearInterval(countdownIntervals.get(timeLeftId));
                countdownIntervals.delete(timeLeftId);
            }

            // Start new countdown
            let remainingMs = targetTime - now;
            const countdownInterval = setInterval(() => {
                const el = document.getElementById(timeLeftId);
                if (!el) {
                    clearInterval(countdownInterval);
                    countdownIntervals.delete(timeLeftId);
                    return;
                }

                if (remainingMs <= 0) {
                    clearInterval(countdownInterval);
                    countdownIntervals.delete(timeLeftId);
                    if (el) {
                    el.textContent = "0s";
                    el.style.color = "#dc3545"; // Final red color
                }
                    ExamController.loadExams();
                    return;
                }

                if (el) {
                el.textContent = formatRemainingTime(remainingMs);

                // 🔴 Change color to red if under 5 minutes
                if (remainingMs < 5 * 60 * 1000) {
                    el.style.color = "#dc3545"; // Bootstrap red
                } else {
                    el.style.color = "#007bff"; // Bootstrap blue (default)
                }
            }
                remainingMs -= 1000;
            }, 1000);

            // Store the interval
            countdownIntervals.set(timeLeftId, countdownInterval);

        });

        this.setupEventListeners(); // Keep using the same listeners
    },


    showExamDetails: async function (exam, targetTime) {
        const container = document.getElementById('examContainer');
        container.innerHTML = '';

        const timeLeftId2 = `expanded-timer-${exam.course_name}-${exam.exam_no}-${exam.batch}`.replace(/\s+/g, '-');

        const [timeData] = await Promise.all([
            gettime()
        ]);
        const now = new Date(timeData);
        const card = document.createElement('div');
        card.classList.add('exam-card');
        card.style.width = '100%';
        card.style.maxWidth = '800px';
        card.style.margin = '0 auto';
        card.dataset.course = exam.course_name;
        card.dataset.exam = exam.exam_no;
        card.dataset.batch = exam.batch;

        card.innerHTML = `
        <h2>${exam.course_name}</h2>
        <p><strong>Batch:</strong> ${exam.batch}</p>
        <p><strong>Exam No.:</strong> ${exam.exam_no}</p>
        <p><strong>Date:</strong> ${new Date(exam.exam_date).toLocaleDateString()}</p>
        <p><strong>Start Time:</strong> ${exam.start_time}</p>
        <p><strong>Duration:</strong> ${exam.duration_minutes} minutes</p>
        <p><strong>End Time:</strong> ${exam.finish_time}</p>
        <h1 id="${timeLeftId2}" style="font-size: 5em; color: #007bff; margin: 20px 0;">
            ${formatRemainingTime(targetTime - now)}
        </h1>
        <div class="card-buttons">
            <button class="cancel-btn">Cancel</button>
            ${currentView === 'upcoming' ? '<button class="reschedule-btn">Reschedule</button>' : ''}
            <button class="duration-btn">Change Duration</button>
            <button id="backToList" style="background-color: gray;">Back to List</button>
        </div>
    `;

        container.appendChild(card);

        // Countdown updater
        let remainingMs = targetTime - now;
        if (countdownIntervals.has(timeLeftId2)) {
            clearInterval(countdownIntervals.get(timeLeftId2));
            countdownIntervals.delete(timeLeftId2);
        }

        const countdownInterval = setInterval(() => {
            const el = document.getElementById(timeLeftId2);
            if (remainingMs <= 0) {
                clearInterval(countdownInterval);
                if (el) {
                    el.textContent = "0s";
                    el.style.color = "#dc3545"; // Final red color
                }

                // Detect if it's start or end of exam

                if (Math.abs(remainingMs) < 5000 && currentView == 'upcoming') {
                    showNotification(`🟢 ${exam.course_name} exam has started.`);
                } else if (Math.abs(remainingMs) < 5000) {
                    showNotification(`🔴 ${exam.course_name} exam has ended.`);
                }

                this.loadExams();
                return;
            }


            if (el) {
                el.textContent = formatRemainingTime(remainingMs);

                // 🔴 Change color to red if under 5 minutes
                if (remainingMs < 5 * 60 * 1000) {
                    el.style.color = "#dc3545"; // Bootstrap red
                } else {
                    el.style.color = "#007bff"; // Bootstrap blue (default)
                }
            }

            remainingMs -= 1000;
        }, 1000);
        countdownIntervals.set(timeLeftId2, countdownInterval);



        // Add event listeners for actions
        card.querySelector('.cancel-btn')?.addEventListener('click', this.handleCancelExam.bind(this));
        card.querySelector('.reschedule-btn')?.addEventListener('click', this.showRescheduleForm.bind(this));
        card.querySelector('.duration-btn')?.addEventListener('click', this.showDurationForm.bind(this));
        document.getElementById('backToList').addEventListener('click', () => {
            clearInterval(countdownInterval);
            this.loadExams();
        });
    },

    _getSelectedExamFromExpandedView: async function () {
        const card = document.querySelector('.exam-card');
        if (!card) return null;
        return {
            course_name: card.dataset.course,
            exam_no: Number(card.dataset.exam),
            batch: Number(card.dataset.batch)
        };
    },


    /**
     * Sets up all event listeners
     */
    setupEventListeners: function () {
        // Cancel buttons
        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', this.handleCancelExam.bind(this));
        });

        // Reschedule buttons
        document.querySelectorAll('.reschedule-btn').forEach(btn => {
            btn.addEventListener('click', this.showRescheduleForm.bind(this));
        });

        // Duration buttons
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', this.showDurationForm.bind(this));
        });

        // Form submission
        //document.getElementById('examForm').addEventListener('submit', this.handleCreateExam.bind(this));
    },

    /**
     * Handles exam cancellation
     * @param {Event} e - Click event
     */
    handleCancelExam: async function (e) {
        e.stopPropagation();
        const exam = await this._getSelectedExamFromExpandedView();
        if (!exam) return;

        
            try {
                await ExamService.cancelExam(exam.course_name, exam.exam_no, exam.batch);
                alert('Exam cancelled successfully!');
                this.loadExams();
            } catch (error) {
                alert(`Failed to cancel exam: ${error.message}`);
            }
    },


    /**
     * Shows the reschedule form
     * @param {Event} e - Click event
     */
    showRescheduleForm: function (e) {
        const card = e.target.closest('.exam-card');

        // Remove existing form if any
        const existing = card.querySelector('.reschedule-form');
        if (existing) existing.remove();

        const form = document.createElement('div');
        form.classList.add('reschedule-form');
        form.innerHTML = `
        <input type="date" class="new-date" required>
        <input type="time" class="new-time" required>
        <button class="confirm-reschedule">Confirm</button>
        <button class="cancel-action">Cancel</button>
    `;
        card.appendChild(form);

        form.querySelector('.confirm-reschedule').addEventListener('click', this.handleRescheduleExam.bind(this));
        form.querySelector('.cancel-action').addEventListener('click', () => this.loadExams());
    },

    /**
     * Handles exam rescheduling
     * @param {Event} e - Click event
     */
    handleRescheduleExam: async function (e) {
        const card = e.target.closest('.exam-card');
        const course = card.dataset.course;
        const exam = card.dataset.exam;
        const batch = card.dataset.batch;

        const newDate = card.querySelector('.new-date').value;
        const newTime = card.querySelector('.new-time').value;

        if (!newDate || !newTime) {
            alert('Please enter both date and time');
            return;
        }

        try {
            await ExamService.rescheduleExam(course, exam, batch, newDate, newTime);
            this.loadExams();
            alert('Exam rescheduled successfully!');
        } catch (error) {
            alert(`Failed to reschedule exam: ${error.message}`);
        }
    },


    /**
     * Shows the duration change form
     * @param {Event} e - Click event
     */
    showDurationForm: function (e) {
        const card = e.target.closest('.exam-card');

        const form = document.createElement('div');
        form.classList.add('duration-form');
        form.innerHTML = `
        <input type="number" class="new-duration" placeholder="New duration (minutes)" required min="1">
        <button class="confirm-duration">Update</button>
        <button class="cancel-action">Cancel</button>
    `;
        card.appendChild(form);

        form.querySelector('.confirm-duration').addEventListener('click', this.handleUpdateDuration.bind(this));
        form.querySelector('.cancel-action').addEventListener('click', () => this.loadExams());
    },


    /**
     * Handles duration update
     * @param {Event} e - Click event
     */
    handleUpdateDuration: async function (e) {
        const card = e.target.closest('.exam-card');
        const course = card.dataset.course;
        const exam = card.dataset.exam;
        const batch = card.dataset.batch;

        const newDuration = card.querySelector('.new-duration').value;

        if (!newDuration || newDuration <= 0) {
            alert('Please enter a valid duration');
            return;
        }

        try {
            await ExamService.updateDuration(course, exam, batch, newDuration);
            this.loadExams();
            alert('Duration updated successfully!');
        } catch (error) {
            alert(`Failed to update duration: ${error.message}`);
        }
    },


    /**
     * Handles new exam creation
     * @param {Event} e - Form submit event
     */
    handleCreateExam: async function (e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const examData = Object.fromEntries(formData.entries());

        try {
            await ExamService.createExam(examData);
            this.loadExams();
            e.target.reset();
            alert('Exam created successfully!');
        } catch (error) {
            alert(`Failed to create exam: ${error.message}`);
        }
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Attach once here, not in setupEventListeners
    document.getElementById('examForm').addEventListener('submit', ExamController.handleCreateExam.bind(ExamController));

    document.getElementById('ongoingBtn').addEventListener('click', () => {
        currentView = 'ongoing';
        document.getElementById('ongoingBtn').classList.add('active');
        document.getElementById('upcomingBtn').classList.remove('active');
        ExamController.loadExams();
    });

    document.getElementById('upcomingBtn').addEventListener('click', () => {
        currentView = 'upcoming';
        document.getElementById('upcomingBtn').classList.add('active');
        document.getElementById('ongoingBtn').classList.remove('active');
        ExamController.loadExams();
    });

    ExamController.loadExams(); // Only once
});
