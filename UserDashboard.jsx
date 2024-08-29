import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faUser, faCar } from '@fortawesome/free-solid-svg-icons'; // Import icons
import { Link } from 'react-router-dom'; // Import Link from react-router-dom
import Web3 from 'web3'; // Import Web3 object
import { toast } from 'react-toastify';
import MapPage from './MapPage'; // Import the MapPage component
import { etherToWei, weiToEther, Helper } from '../utils/Helper'; 
import axios from 'axios';

const UserDashboard = () => {
  const [pickupLocation, setPickupLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [fare, setFareAmount] = useState(0);
  const [rideId, setRequestedRideId] = useState('');
  const [locationDetails, setLocationDetails] = useState({
    pickupLocationName: '',
    destinationName: ''
  });
  const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser')); // Define loggedInUser here
  const [userAddress, setUserAddress] = useState(loggedInUser.etheriumAddress); // Updated to use etheriumAddress

  const [rideDetails, setRideDetails] = useState(null);
  const [showArrived, setShowArrived] = useState(false);
  
  useEffect(() => {
    let statusInterval;
  
    // Check if rideId is available
    if (rideId) {
      const checkStatus = async () => {
        try {
          const response = await axios.get(`http://localhost:3001/rides/${rideId}`);
          const status = response.data.ride.ride_status;
          console.log("status:", status)
          setRideDetails(response.data.ride);
  
          if (status === 'accepted') {
            // Extract the driver's ID from the response
            const driverId = response.data.ride.driver_id;

            // Fetch the driver's details using their ID
            const driverResponse = await axios.get(`http://localhost:3001/user/${driverId}`);
            const driverName = driverResponse.data.user.username;
            const time = response.data.ride.time;
            toast.info(`Your ride has been accepted by ${driverName} at ${time}`);

          } else if (status === 'done') {
            // Show toast when ride is done
            setShowArrived(true);
            clearInterval(statusInterval); // Stop checking status once status is done
            localStorage.removeItem('acceptedRideId'); // Remove rideId from localStorage
            toast.success('Your ride has been completed!');
          }
        } catch (error) {
          console.error('Error fetching ride status:', error);
        }
      };
  
      statusInterval = setInterval(checkStatus, 3000); // Check status every 2 seconds
  
      // Cleanup function to clear the interval
      return () => clearInterval(statusInterval);
    }
  }, [rideId]); // Include rideId in the dependency array to rerun the effect when it changes
  

  useEffect(() => {
    if (pickupLocation && destination) {
      const distance = Helper.calculateDistance(pickupLocation, destination);
      const fare = Helper.calculateFare(distance);
      setFareAmount(fare);

      fetchLocationDetails();
    }
  }, [pickupLocation, destination]);

  const fetchLocationDetails = async () => {
    try {
      const pickupDetails = await fetchLocationName(pickupLocation.lat, pickupLocation.lng);
      const destinationDetails = await fetchLocationName(destination.lat, destination.lng);

      setLocationDetails({
        pickupLocationName: pickupDetails,
        destinationName: destinationDetails
      });
    } catch (error) {
      console.error('Error fetching location details:', error);
    }
  };

  const fetchLocationName = async (lat, lng) => {
    return new Promise((resolve, reject) => {
      const geocoder = new window.google.maps.Geocoder();
      const latlng = { lat, lng };
      geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK') {
          if (results[0]) {
            resolve(results[0].formatted_address);
          } else {
            reject(new Error('Location not found'));
          }
        } else {
          reject(new Error('Geocoder failed'));
        }
      });
    });
  };

  const handlePickupLocationChange = (location) => {
    setPickupLocation(location);
  };

  const handleDestinationChange = (location) => {
    setDestination(location);
  };

  const requestRide = async () => {
    if (!pickupLocation || !destination) {
      toast.error('Please select both pickup and destination locations');
      return;
    }

    // Retrieve userId from localStorage
    if (!loggedInUser || !loggedInUser._id) {
      toast.error('User ID not found. Please log in again.');
      return;
    }

    const userId = loggedInUser._id;

    // Check user balance
    try {
      const web3 = new Web3('http://127.0.0.1:8545');
      const userBalance = await web3.eth.getBalance(userAddress);

      // Convert balance from wei to Ether
      const userBalanceInEther = web3.utils.fromWei(userBalance, 'ether');

      // Calculate fare based on distance
      const distance = Helper.calculateDistance(pickupLocation, destination);
      const fare = Helper.calculateFare(distance);
      
      // Check if user has enough balance to book the ride
      if (parseFloat(userBalanceInEther) < fare) {
        toast.error('Your account does not have enough ether to book this ride.');
        return;
      }

      // Send ride request to backend with userId included
      sendRideRequest({ userId, pickupLocation, destination, fare });
    } catch (error) {
      console.error('Error checking user balance:', error);
      toast.error('Error checking user balance. Please try again later.');
    }
  };

  const sendRideRequest = () => {
    // Create ride object with all necessary data
    const rideData = {
      userId: loggedInUser._id,
      source: pickupLocation,
      destination: destination,
      fare: fare, 
      dateTime: new Date().toISOString(),
      userAddress: loggedInUser.etheriumAddress 
    };


    

    // Log rideData and userId
    console.log('Ride data to send:', rideData);
    console.log('User ID:', loggedInUser._id);

    // Send ride request to backend
    fetch('http://localhost:3001/request-ride', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rideData),
    })
    .then((response) => response.json())
    .then((data) => {
      console.log('Response:', data);
      localStorage.setItem('requestedRides',data.rideId);
      setRequestedRideId(data.rideId)
      console.log('User ID:', loggedInUser._id);
      console.log('Fare:', fare);
      console.log('Source:', pickupLocation);
      console.log('Destination:', destination);
      console.log("Address", userAddress)
      if (data.success) {
        toast.success(
          <div>
            <FontAwesomeIcon icon={faCar} style={{ marginRight: '0.5rem' }} />
            Ride requested successfully. Please wait for the driver to arrive.
          </div>,
          { className: 'success-toast' }
        );

      } else {
        console.error('Failed to request ride:', data.message);
        toast.error(
          `Error requesting ride: ${data.message}`,
          { className: 'error-toast' }
        );
       
      }
    })
    .catch((error) => {
      console.error('Error requesting ride:', error);
      toast.error(
        `Error requesting ride: ${error}`,
        { className: 'error-toast' }
      );
    });
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-bold text-blue-900">User Dashboard</h2>
        </div>
        
        <div className="bg-white rounded p-4 mt-4">
          <h3 className="text-xl font-semibold mb-2">Ride Details</h3>
          <div className="flex flex-col mb-2">
            <label htmlFor="pickupLocation" className="font-semibold">Pickup Location:</label>
            <input
              id="pickupLocation"
              type="text"
              className="border border-gray-300 rounded px-2 py-1 mt-1"
              value={locationDetails.pickupLocationName}
              readOnly
            />
          </div>
          <div className="flex flex-col mb-2">
            <label htmlFor="destination" className="font-semibold">Destination:</label>
            <input
              id="destination"
              type="text"
              className="border border-gray-300 rounded px-2 py-1 mt-1"
              value={locationDetails.destinationName}
              readOnly
            />
          </div>
          {fare > 0 && (
            <div className="flex flex-col mb-2">
              <label htmlFor="fare" className="font-semibold">Fare:</label>
              <input
                id="fare"
                type="text"
                className="border border-gray-300 rounded px-2 py-1 mt-1"
                value={`${fare} ETH`}
                readOnly
              />
            </div>
          )}
        </div>

        <MapPage 
          pickupLocation={pickupLocation} 
          setPickupLocation={handlePickupLocationChange} 
          destination={destination} 
          setDestination={handleDestinationChange} 
          pickupLocationName={locationDetails.pickupLocationName} 
          setPickupLocationName={(name) => setLocationDetails({...locationDetails, pickupLocationName: name})} 
          destinationName={locationDetails.destinationName} 
          setDestinationName={(name) => setLocationDetails({...locationDetails, destinationName: name})} 
        />

        <button onClick={requestRide} className="request-ride-btn bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4">
          Request Ride
        </button>
      </div>
    </div>
  );
};

export default UserDashboard;
