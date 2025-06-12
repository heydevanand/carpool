let currentRideId = null;

// PG coordinates for GPS detection
const PG_LOCATIONS = {
    'Puraani PG': { lat: 28.498654727164496, lng: 77.3823826486981 },
    'Nayi PG': { lat: 28.498758401634124, lng: 77.3840885546646 }
};

// GPS detection state
let gpsDetectionState = {
    isDetecting: false,
    isDetected: false,
    userLocation: null,
    nearbyPG: null
};

// Initialize date/time selection and populate time dropdown
document.addEventListener('DOMContentLoaded', function() {
    initializeDateTimeSelection();
    setupJourneyTypeHandler();
    initializeGPSDetection();
});

function initializeDateTimeSelection() {
    const departureDateInput = document.getElementById('departureDate');
    const departureTimeSelect = document.getElementById('departureTimeSelect');
    
    if (!departureDateInput || !departureTimeSelect) {
        console.error('Could not find date or time selection elements');
        return;
    }
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    departureDateInput.min = today;
    departureDateInput.value = today;
    
    populateTimeOptions(departureTimeSelect);
    setDefaultTime(departureTimeSelect);
    
    departureDateInput.addEventListener('change', function() {
        const selectedDate = this.value;
        const today = new Date().toISOString().split('T')[0];
        
        if (selectedDate === today) {
            setDefaultTime(departureTimeSelect);
        }
    });
}

function populateTimeOptions(selectElement) {
    selectElement.innerHTML = '<option value="">Select departure time</option>';
    
    for (let hour = 8; hour <= 20; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const displayTime = formatTimeForDisplay(hour, minute);
            
            const option = document.createElement('option');
            option.value = timeString;
            option.textContent = displayTime;
            selectElement.appendChild(option);
        }
    }
}

function formatTimeForDisplay(hour, minute) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${ampm}`;
}

function setDefaultTime(selectElement) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    let nextMinute = Math.ceil(currentMinute / 15) * 15;
    let nextHour = currentHour;
    
    if (nextMinute >= 60) {
        nextMinute = 0;
        nextHour++;
    }
    
    if (nextHour < 8) {
        nextHour = 8;
        nextMinute = 0;
    } else if (nextHour > 20) {
        const dateInput = document.getElementById('departureDate');
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        dateInput.value = nextDay.toISOString().split('T')[0];
        nextHour = 8;
        nextMinute = 0;
    }
    
    const defaultTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
    selectElement.value = defaultTime;
}

// Create ride form submission
document.getElementById('create-ride-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const departureDate = document.getElementById('departureDate').value;
    const departureTime = document.getElementById('departureTimeSelect').value;
    const journeyType = document.getElementById('journeyType').value;
    const pgLocation = document.getElementById('pgLocation').value;
    const officeLocation = document.getElementById('officeLocation').value;
    
    const combinedDateTime = `${departureDate}T${departureTime}:00`;
    
    let origin, destination;
    if (journeyType === 'to-office') {
        origin = pgLocation;
        destination = officeLocation;
    } else if (journeyType === 'from-office') {
        origin = officeLocation;
        destination = pgLocation;
    }
    
    const formData = {
        passengerName: document.getElementById('passengerName').value,
        passengerPhone: document.getElementById('passengerPhone').value,
        origin: origin,
        destination: destination,
        departureTime: combinedDateTime
    };

    // Validation
    if (!departureDate || !departureTime) {
        alert('Please select both departure date and time!');
        return;
    }
    
    if (!journeyType) {
        alert('Please select journey type (To Office or From Office)!');
        return;
    }
    
    if (!pgLocation || !officeLocation) {
        alert('Please wait for location auto-selection or select manually!');
        return;
    }
    
    if (formData.origin === formData.destination) {
        alert('Origin and destination cannot be the same!');
        return;
    }

    const selectedDateTime = new Date(combinedDateTime);
    const now = new Date();
    if (selectedDateTime <= now) {
        alert('Please select a future date and time!');
        return;
    }

    const selectedHour = selectedDateTime.getHours();
    if (selectedHour < 8 || selectedHour > 20) {
        alert('Rides are only available between 8:00 AM and 8:00 PM!');
        return;
    }    try {
        performanceMonitor.start('Creating ride request');
        
        // Add loading state
        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
        submitButton.disabled = true;

        const response = await makeApiRequest('/api/rides', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        performanceMonitor.end('Creating ride request');

        const message = response.message || 'Ride request submitted successfully!';
        showNotification(message, 'success');
        document.getElementById('create-ride-form').reset();
        refreshRides();
        
        // Reset button
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error creating ride request. Please try again.', 'error');        // Reset button on error
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.innerHTML = '<i class="fas fa-plus"></i> Request Ride';
        submitButton.disabled = false;
    }
});

function setupJourneyTypeHandler() {
    const journeyTypeSelect = document.getElementById('journeyType');
    const pgSelection = document.getElementById('pgSelection');
    const officeSelection = document.getElementById('officeSelection');

    journeyTypeSelect.addEventListener('change', function() {
        const journeyType = this.value;
        
        if (gpsDetectionState.isDetected && this.value !== '') {
            updateGPSStatus('manual-override', 'Manual selection overriding GPS detection');
        }

        if (journeyType === 'to-office') {
            pgSelection.style.display = 'none';
            officeSelection.style.display = 'block';
            officeSelection.querySelector('label').textContent = 'Drop Location';
        } else if (journeyType === 'from-office') {
            officeSelection.style.display = 'block';
            pgSelection.style.display = 'none';
            officeSelection.querySelector('label').textContent = 'Pickup Location';
        } else {
            pgSelection.style.display = 'none';
            officeSelection.style.display = 'none';
        }
        
        document.getElementById('pgLocation').value = '';
        document.getElementById('officeLocation').value = '';
    });
}

function joinRide(rideId) {
    currentRideId = rideId;
    const modal = new bootstrap.Modal(document.getElementById('joinRideModal'));
    modal.show();
}

async function confirmJoinRide() {
    const passengerName = document.getElementById('joinPassengerName').value;
    const passengerPhone = document.getElementById('joinPassengerPhone').value;

    if (!passengerName || !passengerPhone) {
        alert('Please fill in all fields!');
        return;
    }

    try {
        const response = await fetch(`/api/rides/${currentRideId}/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                passengerName,
                passengerPhone
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert('Successfully joined the trip request!');
            document.getElementById('join-ride-form').reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById('joinRideModal'));
            modal.hide();
            refreshRides();
        } else {
            alert('Error joining trip: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error joining ride. Please try again.');
    }
}

async function refreshRides() {
    try {
        const response = await makeApiRequest('/api/rides');
        updateRidesUI(response);
    } catch (error) {
        console.error('Error refreshing rides:', error);
        showNotification('Error loading rides. Please try again.', 'error');
    }
}

// Optimized UI update function
function updateRidesUI(rides) {
    try {
        const container = document.getElementById('rides-container');

        if (rides.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> No ride requests at the moment. Be the first to request one!
                </div>
            `;
            return;
        }

        container.innerHTML = rides.map(ride => {
            const departureTime = new Date(ride.departureTime);

            return `
                <div class="card ride-card available">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-primary time-badge me-2">
                                        ${departureTime.toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true, timeZone: 'UTC'})}
                                    </span>
                                    <small class="text-muted">
                                        ${departureTime.toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'})}
                                    </small>
                                </div>
                                <div class="route-info">
                                    <div class="location-text">
                                        <i class="fas fa-map-marker-alt text-success"></i>
                                        <strong>From:</strong> ${ride.origin.name}
                                    </div>
                                    <div class="location-text">
                                        <i class="fas fa-map-marker-alt text-danger"></i>
                                        <strong>To:</strong> ${ride.destination.name}
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="text-center">
                                    <div class="passenger-count">
                                        <i class="fas fa-users"></i>
                                        ${ride.passengers.length} interested
                                    </div>
                                    <small class="text-muted">
                                        Join this trip!
                                    </small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <button class="btn btn-primary btn-sm w-100" onclick="joinRide('${ride._id}')">
                                    <i class="fas fa-plus"></i> Join Trip
                                </button>
                            </div>
                        </div>
                        ${ride.passengers.length > 0 ? `
                            <div class="passengers-info mt-2">
                                <small class="text-muted">
                                    <i class="fas fa-users"></i> Passengers:
                                </small>
                                ${ride.passengers.map(passenger => {
                                    const cleanPhone = passenger.phone.replace(/[^0-9]/g, '').slice(-10);
                                    return `
                                    <div class="ms-3 mb-1">
                                        <small>• ${passenger.name}</small>
                                        <br>
                                        <small class="ms-3 text-muted">
                                            <i class="fas fa-phone text-success me-1" style="font-size: 0.7rem;"></i>
                                            <a href="tel:${cleanPhone}" class="phone-link">${cleanPhone}</a>
                                        </small>
                                    </div>
                                `}).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;        }).join('');

    } catch (error) {
        console.error('Error updating rides UI:', error);
        showNotification('Error displaying rides', 'error');
    }
}

setInterval(refreshRides, 120000);

// GPS Location Detection Functions
function initializeGPSDetection() {
    addGPSStatusIndicator();
    
    if ("geolocation" in navigator) {
        requestLocationPermission();
    } else {
        updateGPSStatus('not-supported', 'GPS not supported - Select manually');
    }
}

function addGPSStatusIndicator() {
    const formHeader = document.querySelector('.card-header');
    const gpsIndicator = document.createElement('div');
    gpsIndicator.id = 'gpsStatusIndicator';
    gpsIndicator.className = 'border-bottom px-3 py-2 bg-light';
    gpsIndicator.style.fontSize = '0.85rem';
    gpsIndicator.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <div class="spinner-border text-primary me-2" style="width: 1rem; height: 1rem;" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span class="text-muted">🌍 Auto-detecting location...</span>
            </div>
            <small class="text-muted">GPS</small>
        </div>
    `;
    
    formHeader.parentNode.insertBefore(gpsIndicator, formHeader.nextSibling);
}

function requestLocationPermission() {
    gpsDetectionState.isDetecting = true;
    updateGPSStatus('detecting', 'Getting your location...');
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
    };
    
    navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        onLocationError,
        options
    );
}

function onLocationSuccess(position) {
    gpsDetectionState.isDetecting = false;
    gpsDetectionState.isDetected = true;
    gpsDetectionState.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };
    
    const nearbyPG = findNearbyPG(gpsDetectionState.userLocation);
    gpsDetectionState.nearbyPG = nearbyPG;
    
    if (nearbyPG) {
        autoSetJourneyType('to-office', nearbyPG);
        updateGPSStatus('near-pg', `Near PG - Auto-selected TO Office`);
    } else {
        autoSetJourneyType('from-office', null);
        updateGPSStatus('away-from-pg', 'Away from PG - Auto-selected FROM Office');
    }
}

function onLocationError(error) {
    gpsDetectionState.isDetecting = false;
    gpsDetectionState.isDetected = false;
    
    let errorMessage = 'Location unavailable - Select manually';
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied - Select manually';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable - Select manually';
            break;
        case error.TIMEOUT:
            errorMessage = 'Location timeout - Select manually';
            break;
    }
    
    updateGPSStatus('error', errorMessage);
}

function findNearbyPG(userLocation) {
    const MAX_DISTANCE_KM = 0.5;
    
    for (const [pgName, pgCoords] of Object.entries(PG_LOCATIONS)) {
        const distance = calculateDistance(userLocation, pgCoords);
        
        if (distance <= MAX_DISTANCE_KM) {
            return { name: pgName, coords: pgCoords, distance: distance };
        }
    }
    
    return null;
}

function calculateDistance(coord1, coord2) {
    const R = 6371;
    const dLat = toRadians(coord2.lat - coord1.lat);
    const dLng = toRadians(coord2.lng - coord1.lng);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function autoSetJourneyType(journeyType, nearbyPG) {
    const journeyTypeSelect = document.getElementById('journeyType');
    journeyTypeSelect.value = journeyType;
    
    journeyTypeSelect.dispatchEvent(new Event('change'));
    
    setTimeout(() => {
        if (journeyType === 'to-office') {
            const pgSelect = document.getElementById('pgLocation');
            const firstPGOption = pgSelect.querySelector('option[value!=""]');
            if (firstPGOption) {
                pgSelect.value = firstPGOption.value;
            }
        } else {
            const officeSelect = document.getElementById('officeLocation');
            const firstOfficeOption = officeSelect.querySelector('option[value!=""]');
            if (firstOfficeOption) {
                officeSelect.value = firstOfficeOption.value;
            }
        }
    }, 100);
}

function updateGPSStatus(status, message) {
    const indicator = document.getElementById('gpsStatusIndicator');
    if (!indicator) return;
    
    switch(status) {
        case 'detecting':
            indicator.className = 'border-bottom px-3 py-2 bg-light';
            indicator.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <div class="spinner-border text-primary me-2" style="width: 1rem; height: 1rem;" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <span class="text-muted">🌍 ${message}</span>
                    </div>
                    <small class="text-muted">GPS</small>
                </div>
            `;
            break;
            
        case 'near-pg':
            indicator.className = 'border-bottom px-3 py-2 bg-success bg-opacity-10';
            indicator.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-check-circle text-success me-2"></i>
                        <span class="text-success fw-medium">✅ ${message}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-success border-0 py-0 px-2" onclick="refreshLocation()" title="Refresh location">
                        <i class="fas fa-refresh" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
            `;
            break;
            
        case 'away-from-pg':
            indicator.className = 'border-bottom px-3 py-2 bg-warning bg-opacity-10';
            indicator.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-map-marker-alt text-warning me-2"></i>
                        <span class="text-warning-emphasis">📍 ${message}</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-warning border-0 py-0 px-2" onclick="refreshLocation()" title="Refresh location">
                        <i class="fas fa-refresh" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
            `;
            break;
            
        case 'manual-override':
            indicator.className = 'border-bottom px-3 py-2 bg-info bg-opacity-10';
            indicator.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-user text-info me-2"></i>
                        <span class="text-info">👤 Manual selection active</span>
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-info border-0 py-0 px-2" onclick="refreshLocation()" title="Reset GPS detection">
                        <i class="fas fa-refresh" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
            `;
            break;
            
        case 'error':
        case 'not-supported':
            indicator.className = 'border-bottom px-3 py-2 bg-secondary bg-opacity-10';
            indicator.innerHTML = `
                <div class="d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <i class="fas fa-info-circle text-muted me-2"></i>
                        <span class="text-muted">ℹ️ ${message}</span>
                    </div>
                    ${status === 'error' ? `
                        <button type="button" class="btn btn-sm btn-outline-secondary border-0 py-0 px-2" onclick="refreshLocation()" title="Try again">
                            <i class="fas fa-refresh" style="font-size: 0.75rem;"></i>
                        </button>
                    ` : '<small class="text-muted">Manual selection</small>'}
                </div>
            `;
            break;
    }
}

function refreshLocation() {
    gpsDetectionState = {
        isDetecting: false,
        isDetected: false,
        userLocation: null,
        nearbyPG: null
    };
    
    document.getElementById('journeyType').value = '';
    document.getElementById('pgLocation').value = '';
    document.getElementById('officeLocation').value = '';
    
    document.getElementById('pgSelection').style.display = 'none';
    document.getElementById('officeSelection').style.display = 'none';
    
    requestLocationPermission();
}

// Notification system for better user feedback
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} notification-toast position-fixed top-0 end-0 m-3`;
    notification.style.zIndex = '9999';
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
        <button type="button" class="btn-close ms-2" onclick="this.parentElement.remove()"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

// Performance monitoring
const performanceMonitor = {
    startTime: null,
    
    start(operation) {
        this.startTime = performance.now();
        console.log(`Starting: ${operation}`);
    },
    
    end(operation) {
        if (this.startTime) {
            const duration = performance.now() - this.startTime;
            console.log(`Completed: ${operation} in ${duration.toFixed(2)}ms`);
            this.startTime = null;
        }
    }
};

// Optimized API request function with retry logic
async function makeApiRequest(url, options = {}, retries = 3) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    };

    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, defaultOptions);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
}

// Debounced function helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
