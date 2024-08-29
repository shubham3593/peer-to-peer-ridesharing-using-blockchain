import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faCar } from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import '@fortawesome/fontawesome-svg-core/styles.css';
import transferEther from '../utils/transferEther';
import { useNavigate } from 'react-router-dom';
import RideStatusPage from './RideStatusPage';

const DriverDashboard = () => {
  const [requestedRides, setRequestedRides] = useState([]);
  const [acceptedRideId, setAcceptedRideId] = useState(null); 
  const navigate = useNavigate();

  const loggedInUser = JSON.parse(localStorage.getItem('loggedInUser')) ?? {};
  const driverAddress = loggedInUser?.etheriumAddress ?? null;
  const driverLocation = loggedInUser?.currentLocation ?? '';

const [expandedRideId, setExpandedRideId] = useState(null);

const toggleDropdown = (rideId) => {
  if (expandedRideId === rideId) {
    setExpandedRideId(null); 
  } else {
    setExpandedRideId(rideId);
  }
};
  useEffect(() => {
    fetchRequestedRides();
  }, []);

  const fetchRequestedRides = async () => {
    try {
      console.log("driverLocation:", driverLocation);
        const response = await axios.get('http://localhost:3001/requested-rides');
        const nearbyRides = response.data.requestedRides.filter(ride => {
        const rideSrcLat = parseFloat(ride.ride_src_lat);
        const rideSrcLng = parseFloat(ride.ride_src_lng);        
        const distance = calculateDistance(driverLocation, `${rideSrcLat},${rideSrcLng}`);
        
        return distance <= 50000;
      });
      
      setRequestedRides(nearbyRides);

      console.log("",nearbyRides);

      setTimeout(() => {
        setRequestedRides([]);
      }, 90000);

    } catch (error) {
      console.error('Error fetching requested rides:', error);
    }
  };
  
  function calculateDistance(point1, point2) {
    const [lat1, lon1] = point1.split(',').map(parseFloat);
    const [lat2, lon2] = point2.split(',').map(parseFloat);
  
    const R = 6371e3; // Radius of the Earth in meters
    const φ1 = lat1 * Math.PI / 180; // Convert latitude to radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
  
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    const distance = R * c; 
    return distance;
  }
  
  
  useEffect(() => {
    fetchRequestedRides();
  }, []);

  

  {console.log(requestedRides)}

  const acceptRide = async (rideId, userId, fareAmount, userAdd, ride) => {
    try {
      const userAddress = userAdd;
      const driverId = loggedInUser ? loggedInUser._id : null;
      

      // Check if the driver has already accepted 4 rides within the last 5 seconds
      const acceptedRidesInLast5Seconds = JSON.parse(localStorage.getItem('acceptedRidesInLast5Seconds')) ?? [];
      const currentTime = new Date().getTime();
      const recentRides = acceptedRidesInLast5Seconds.filter(ride => currentTime - ride.time <= 20000);

      if (recentRides.length >= 4) {
        toast.error('You can only accept 4 rides within 20 seconds.');
        return;
      }

      // Store the accepted ride in local storage
      localStorage.setItem('acceptedRidesInLast5Seconds', JSON.stringify([...recentRides, { rideId, time: currentTime }]));

      // Proceed with accepting the ride
      const response = await axios.post('http://localhost:3001/accept-ride', { rideId, driverId, userId, fareAmount, userAdd, userAddress });
      console.log(response.data)
      const updatedRequestedRides = requestedRides.map(r => {
        if (r._id === rideId) {
          return { ...r, ride_status: 'accepted' };
        }
        return r;
      });
      
      setRequestedRides(updatedRequestedRides);
  
      // Store the accepted ride ID in local storage
      localStorage.setItem('acceptedRideId', rideId);
  
      console.log("User Add:",userAddress)
      console.log("Fare",fareAmount)
      console.log("Driver Address",driverAddress)

      const transactionDetails = await transferEther(userAddress,driverAddress,fareAmount);
      console.log(transactionDetails)
      toast.success('Ride accepted successfully!', { icon: <FontAwesomeIcon icon={faCheckCircle} />, autoClose: 3000 });
      
      // Set the acceptedRideId state here
      setAcceptedRideId(rideId);
      navigate(`/ride-status/${rideId}`);
      console.log(rideId);
  
    } catch (error) {
      console.error('Error accepting ride:', error);
      toast.error('Error accepting ride. Please try again later.');
    }
  };

  const ConvertToAddress = ({ latitude, longitude, apiKey }) => {
    const [address, setAddress] = useState('');
  
    useEffect(() => {
      const fetchAddress = async () => {
        try {
          const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);
          const { results } = response.data;
          if (results && results.length > 0) {
            setAddress(results[0].formatted_address);
          }
        } catch (error) {
          console.error('Error fetching address:', error);
        }
      };
  
      fetchAddress();
    }, [latitude, longitude, apiKey]);
  
    return <span>{address}</span>;
  };
  

  return (
    <div className="container mx-auto p-4">
      {requestedRides.length === 0 ? (
        <div className="text-center">
          <p className="text-lg mb-2">No nearby ride requests available.</p>
          <p className="text-lg mb-2">Take a break or check back later!</p>
          <FontAwesomeIcon icon={faCar} size="4x" className="text-blue-500" />
        </div>
      ) : (
        <div className="w-full max-w-lg">
          <h2 className="text-xl font-semibold mb-4">Nearby Ride Requests</h2>
          {requestedRides.map((ride) => (
            <div key={ride._id} className="border rounded-lg p-4 mb-4 shadow-md">
              <p className="text-gray-600">RIDE ID: {ride._id.toUpperCase()}</p>
              <p className="text-gray-600">Requested By: {ride.user_id.username}</p>
              <p className="text-gray-600">Contact No: {ride.user_id.contact}</p>
              <p className="text-gray-600">Source: <ConvertToAddress latitude={ride.ride_src_lat} longitude={ride.ride_src_lng} apiKey="AIzaSyChykMQlbWKcQy-qixkVnXCrGVoy-vdlM4" /></p>
              <p className="text-gray-600">Destination: <ConvertToAddress latitude={ride.ride_dest_lat} longitude={ride.ride_dest_lng} apiKey="AIzaSyChykMQlbWKcQy-qixkVnXCrGVoy-vdlM4" /></p>
              <p className="text-gray-600">Fare: {ride.ride_fare}</p>
              <button onClick={() => acceptRide(ride._id, ride.user_id._id, ride.ride_fare, ride.user_id.etheriumAddress, ride)} className="bg-blue-500 text-white px-4 py-2 mt-2 rounded-md hover:bg-blue-600 transition duration-300">
                Accept Ride
              </button>
            </div>
          ))}
        </div>
      )}

      {acceptedRideId && <RideStatusPage isDriver={false}/>}
    </div>
  );
};

export default DriverDashboard;