let currentRideId = null;

// Set minimum datetime to current time
document.addEventListener('DOMContentLoaded', function() {
    const now = new Date();
    // Format for datetime-local input (YYYY-MM-DDTHH:MM)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    document.getElementById('departureTime').min = minDateTime;
    
    // Don't auto-refresh on page load - use server-rendered content
    // refreshRides();
});

// Create ride form submission
document.getElementById('create-ride-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        passengerName: document.getElementById('passengerName').value,
        passengerPhone: document.getElementById('passengerPhone').value,
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        departureTime: document.getElementById('departureTime').value
    };

    // Validation
    if (formData.origin === formData.destination) {
        alert('Origin and destination cannot be the same!');
        return;
    }

    try {
        const response = await fetch('/api/rides', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            const message = result.message || 'Ride request submitted successfully!';
            alert(message);
            document.getElementById('create-ride-form').reset();
            refreshRides();
        } else {
            alert('Error creating ride request: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating ride request. Please try again.');
    }
});

// Join ride function
function joinRide(rideId) {
    currentRideId = rideId;
    const modal = new bootstrap.Modal(document.getElementById('joinRideModal'));
    modal.show();
}

// Confirm join ride
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

        const result = await response.json();        if (response.ok) {
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

// Refresh rides
async function refreshRides() {
    try {
        const response = await fetch('/api/rides');
        const rides = await response.json();

        const container = document.getElementById('rides-container');
          if (rides.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> No ride requests at the moment. Be the first to request one!
                </div>
            `;
            return;
        }        container.innerHTML = rides.map(ride => {
            const departureTime = new Date(ride.departureTime);

            return `
                <div class="card ride-card available">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <div class="d-flex align-items-center mb-2">                                    <span class="badge bg-primary time-badge me-2">
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
                        </div>                        ${ride.passengers.length > 0 ? `
                            <div class="passengers-info mt-2">
                                <small class="text-muted">
                                    <i class="fas fa-users"></i> Passengers:
                                </small>                                ${ride.passengers.map(passenger => {
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
            `;
        }).join('');

    } catch (error) {
        console.error('Error refreshing rides:', error);
        alert('Error loading rides. Please refresh the page.');
    }
}

// Auto-refresh rides every 2 minutes instead of 30 seconds
setInterval(refreshRides, 120000);
