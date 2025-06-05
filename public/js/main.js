let currentRideId = null;

// Set minimum datetime to current time
document.addEventListener('DOMContentLoaded', function() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('departureTime').min = now.toISOString().slice(0, 16);
});

// Create ride form submission
document.getElementById('create-ride-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = {
        creatorName: document.getElementById('creatorName').value,
        creatorPhone: document.getElementById('creatorPhone').value,
        origin: document.getElementById('origin').value,
        destination: document.getElementById('destination').value,
        departureTime: document.getElementById('departureTime').value,
        maxPassengers: document.getElementById('maxPassengers').value,
        notes: document.getElementById('notes').value
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
            alert('Ride created successfully!');
            document.getElementById('create-ride-form').reset();
            refreshRides();
        } else {
            alert('Error creating ride: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error creating ride. Please try again.');
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
    const passengerName = document.getElementById('passengerName').value;
    const passengerPhone = document.getElementById('passengerPhone').value;

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
            alert('Successfully joined the ride!');
            document.getElementById('join-ride-form').reset();
            const modal = bootstrap.Modal.getInstance(document.getElementById('joinRideModal'));
            modal.hide();
            refreshRides();
        } else {
            alert('Error joining ride: ' + result.error);
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
                    <i class="fas fa-info-circle"></i> No rides available at the moment.
                </div>
            `;
            return;
        }

        container.innerHTML = rides.map(ride => {
            const departureTime = new Date(ride.departureTime);
            const availableSeats = ride.maxPassengers - ride.passengers.length;
            const isAvailable = availableSeats > 0;

            return `
                <div class="card ride-card ${isAvailable ? 'available' : 'full'}">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-6">
                                <div class="d-flex align-items-center mb-2">
                                    <span class="badge bg-primary time-badge me-2">
                                        ${departureTime.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    <small class="text-muted">
                                        ${departureTime.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
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
                                        ${ride.passengers.length}/${ride.maxPassengers}
                                    </div>
                                    <small class="text-muted">
                                        ${availableSeats} seats left
                                    </small>
                                </div>
                            </div>
                            <div class="col-md-3">
                                ${isAvailable ? 
                                    `<button class="btn btn-primary btn-sm w-100" onclick="joinRide('${ride._id}')">
                                        <i class="fas fa-plus"></i> Join Ride
                                    </button>` : 
                                    `<button class="btn btn-secondary btn-sm w-100" disabled>
                                        <i class="fas fa-times"></i> Full
                                    </button>`
                                }
                            </div>
                        </div>
                        ${ride.notes ? 
                            `<div class="mt-2">
                                <small class="text-muted">
                                    <i class="fas fa-sticky-note"></i> ${ride.notes}
                                </small>
                            </div>` : ''
                        }
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error refreshing rides:', error);
        alert('Error loading rides. Please refresh the page.');
    }
}

// Auto-refresh rides every 30 seconds
setInterval(refreshRides, 30000);
