document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const weatherForm = document.getElementById('weatherForm');
  const cityInput = document.getElementById('cityInput');
  const cityName = document.getElementById('cityName');
  const themeToggle = document.getElementById('themeToggle');
  const locationToggle = document.getElementById('locationToggle');
  
  // Weather Elements
  const weatherElements = {
      temp: document.getElementById('temp'),
      feels_like: document.getElementById('feels_like'),
      humidity: document.getElementById('humidity'),
      cloud_pct: document.getElementById('cloud_pct'),
      wind_speed: document.getElementById('wind_speed'),
      wind_degrees: document.getElementById('wind_degrees'),
      conditionText: document.getElementById('conditionText'),
      weatherIcon: document.getElementById('weatherIcon'),
      sunrise: document.getElementById('sunrise'),
      sunset: document.getElementById('sunset'),
      max_temp: document.getElementById('max_temp'),
      min_temp: document.getElementById('min_temp'),
      lastUpdated: document.getElementById('lastUpdated'),
      uvIndex: document.getElementById('uvIndex'),
      uvProgress: document.getElementById('uvProgress'),
      uvRecommendation: document.getElementById('uvRecommendation'),
      aqiValue: document.getElementById('aqiValue'),
      aqiStatus: document.getElementById('aqiStatus'),
      aqiDetails: document.getElementById('aqiDetails'),
      treePollen: document.getElementById('treePollen'),
      grassPollen: document.getElementById('grassPollen'),
      weedPollen: document.getElementById('weedPollen'),
      pollenRecommendation: document.getElementById('pollenRecommendation'),
      moonIcon: document.getElementById('moonIcon'),
      moonPhase: document.getElementById('moonPhase'),
      hourlyForecast: document.getElementById('hourlyForecast'),
      dailyForecast: document.getElementById('dailyForecast'),
      weatherMap: document.getElementById('weatherMap'),
      mapLayer: document.getElementById('mapLayer')
  };

  // Default cities
  const defaultCities = ['London', 'New York', 'Tokyo', 'Paris', 'Sydney', 'Delhi,India', 'Mumbai', 'Bangalore'];
  
  // Map variables
  let weatherMap = null;
  let mapLayers = {
      temp: null,
      precip: null,
      wind: null,
      clouds: null,
      pressure: null
  };
  
  // Initialize the app
  initMap(20.5937, 78.9629); // Default to India coordinates
  fetchWeather('Delhi,India');
  fetchAirQuality('Delhi');
  fetchPollenData('Delhi');
  
  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);
  
  // Location toggle
  locationToggle.addEventListener('click', getLocation);
  
  // Form submission
  weatherForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const city = cityInput.value.trim();
      if (city) {
          const query = city.toLowerCase() === 'delhi' ? 'Delhi,India' : city;
          fetchWeather(query);
          fetchAirQuality(query.split(',')[0]);
          fetchPollenData(query.split(',')[0]);
          cityInput.value = '';
      }
  });
  
  // Map layer change
  if (weatherElements.mapLayer) {
      weatherElements.mapLayer.addEventListener('change', (e) => {
          updateWeatherMap(e.target.value);
      });
  }

  // Helper function to safely update DOM elements
  function safeUpdateElement(element, value) {
      if (element && value !== undefined && value !== null) {
          element.textContent = value;
      }
  }

  // Fetch with timeout
  async function fetchWithTimeout(url, timeout = 5000) {
      try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          const response = await fetch(url, {
              signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          return response;
      } catch (error) {
          if (error.name === 'AbortError') {
              throw new Error('Request timed out');
          }
          throw error;
      }
  }

  // Get weather icon class
  function getWeatherIconClass(conditionText, isDay = 1) {
      const text = conditionText.toLowerCase();
      
      if (text.includes('rain') && text.includes('light')) return `fas fa-cloud-rain`;
      if (text.includes('rain')) return `fas fa-cloud-showers-heavy`;
      if (text.includes('snow')) return `fas fa-snowflake`;
      if (text.includes('sleet')) return `fas fa-cloud-meatball`;
      if (text.includes('fog') || text.includes('mist')) return `fas fa-smog`;
      if (text.includes('cloud')) return `fas fa-cloud`;
      if (text.includes('sun') || (text.includes('clear') && isDay)) return `fas fa-sun`;
      if (text.includes('clear') && !isDay) return `fas fa-moon`;
      if (text.includes('thunder') || text.includes('storm')) return `fas fa-bolt`;
      return `fas fa-cloud-sun`;
  }

  // Toggle theme between light/dark
  function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Update icon
      const icon = themeToggle.querySelector('i');
      if (icon) {
          icon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
      }
      
      // Update map tiles if needed
      if (weatherMap) {
          if (newTheme === 'dark') {
              weatherMap.eachLayer(layer => {
                  if (layer._url && layer._url.includes('cartocdn.com')) {
                      layer.setUrl('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
                  }
              });
          } else {
              weatherMap.eachLayer(layer => {
                  if (layer._url && layer._url.includes('cartocdn.com')) {
                      layer.setUrl('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png');
                  }
              });
          }
      }
  }

  // Initialize the map
  function initMap(lat = 20.5937, lng = 78.9629) {
      if (weatherMap) {
          weatherMap.remove();
      }
      
      weatherMap = L.map('weatherMap').setView([lat, lng], 5);
      
      // Add base tile layer (dark mode friendly)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(weatherMap);
      
      // Initialize empty overlay layers
      mapLayers.temp = L.layerGroup().addTo(weatherMap);
      mapLayers.precip = L.layerGroup().addTo(weatherMap);
      mapLayers.wind = L.layerGroup().addTo(weatherMap);
      mapLayers.clouds = L.layerGroup().addTo(weatherMap);
      mapLayers.pressure = L.layerGroup().addTo(weatherMap);
      
      // Hide all layers initially
      Object.values(mapLayers).forEach(layer => layer.remove());
      
      // Show temperature layer by default
      mapLayers.temp.addTo(weatherMap);
  }

  // Update map with weather data
  function updateWeatherMap(layerType = 'temp') {
      if (!weatherMap) return;
      
      // Clear all layers first
      Object.values(mapLayers).forEach(layer => layer.clearLayers());
      
      // Get the current active layer
      const activeLayer = mapLayers[layerType];
      if (!activeLayer) return;
      
      // Add the active layer to map
      activeLayer.addTo(weatherMap);
      
      // Get bounds from current map view
      const bounds = weatherMap.getBounds();
      const { _southWest: sw, _northEast: ne } = bounds;
      
      // Generate API URL based on layer type
      const apiKey = '2ec7aed112a5458e881154832253003';
      let layerUrl = '';
      
      switch(layerType) {
          case 'temp':
              layerUrl = `https://maps.weatherapi.com/weather/maptemp.png?key=${apiKey}&q=auto&days=1`;
              break;
          case 'precip':
              layerUrl = `https://maps.weatherapi.com/weather/map_precipitation.png?key=${apiKey}&q=auto&days=1`;
              break;
          case 'wind':
              layerUrl = `https://maps.weatherapi.com/weather/map_wind.png?key=${apiKey}&q=auto&days=1`;
              break;
          case 'clouds':
              layerUrl = `https://maps.weatherapi.com/weather/map_cloud.png?key=${apiKey}&q=auto&days=1`;
              break;
          case 'pressure':
              layerUrl = `https://maps.weatherapi.com/weather/map_pressure.png?key=${apiKey}&q=auto&days=1`;
              break;
          default:
              layerUrl = `https://maps.weatherapi.com/weather/map_temp.png?key=${apiKey}&q=auto&days=1`;
      }
      
      // Add the overlay image to the map
      const imageBounds = [[sw.lat, sw.lng], [ne.lat, ne.lng]];
      L.imageOverlay(layerUrl, imageBounds).addTo(activeLayer);
      
      // Fit the overlay to the current view
      weatherMap.fitBounds(imageBounds);
  }

  // Get user location
  function getLocation() {
      if (navigator.geolocation) {
          showLoading(true);
          navigator.geolocation.getCurrentPosition(
              async (position) => {
                  try {
                      const { latitude, longitude } = position.coords;
                      const apiKey = '2ec7aed112a5458e881154832253003';
                      const response = await fetchWithTimeout(
                          `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${latitude},${longitude}`
                      );
                      
                      if (!response.ok) throw new Error('Location lookup failed');
                      
                      const data = await response.json();
                      fetchWeather(`${data.location.name},${data.location.country}`);
                      fetchAirQuality(data.location.name);
                      fetchPollenData(data.location.name);
                      
                      // Center map on user location
                      if (weatherMap) {
                          weatherMap.setView([latitude, longitude], 10);
                      }
                  } catch (error) {
                      console.error('Geolocation error:', error);
                      showError('Could not get weather for your location');
                  } finally {
                      showLoading(false);
                  }
              },
              (error) => {
                  console.error('Geolocation error:', error);
                  showError('Location access denied. Please enable location services.');
                  showLoading(false);
              }
          );
      } else {
          showError('Geolocation is not supported by your browser');
      }
  }

  // Update pollen UI
  function updatePollenUI(pollenData) {
      if (!weatherElements.treePollen || !weatherElements.grassPollen || !weatherElements.weedPollen) return;
      
      // Update pollen bars
      weatherElements.treePollen.style.width = `${pollenData.tree * 10}%`;
      weatherElements.grassPollen.style.width = `${pollenData.grass * 10}%`;
      weatherElements.weedPollen.style.width = `${pollenData.weed * 10}%`;
      
      // Set pollen colors
      weatherElements.treePollen.style.background = getPollenColor(pollenData.tree);
      weatherElements.grassPollen.style.background = getPollenColor(pollenData.grass);
      weatherElements.weedPollen.style.background = getPollenColor(pollenData.weed);
      
      // Set recommendation
      const maxPollen = Math.max(pollenData.tree, pollenData.grass, pollenData.weed);
      let recommendation = '';
      
      if (maxPollen <= 3) {
          recommendation = 'Low pollen count. Good day for outdoor activities.';
      } else if (maxPollen <= 6) {
          recommendation = 'Moderate pollen count. Consider taking allergy medication if sensitive.';
      } else if (maxPollen <= 8) {
          recommendation = 'High pollen count. Limit outdoor activities if you have allergies.';
      } else {
          recommendation = 'Very high pollen count. Stay indoors if possible, especially during midday.';
      }
      
      safeUpdateElement(weatherElements.pollenRecommendation, recommendation);
  }

  // Get pollen color based on level
  function getPollenColor(level) {
      if (level <= 3) return '#4CAF50'; // Green
      if (level <= 6) return '#FFC107'; // Yellow
      if (level <= 8) return '#FF9800'; // Orange
      return '#F44336'; // Red
  }

  // Show loading state
  function showLoading(isLoading) {
      const submitBtn = weatherForm?.querySelector('button[type="submit"]');
      if (submitBtn) {
          submitBtn.disabled = isLoading;
          submitBtn.innerHTML = isLoading 
              ? '<i class="fas fa-spinner fa-spin"></i> Loading...' 
              : '<i class="fas fa-search"></i>';
      }
  }

  // Show error message
  function showError(message) {
      const container = document.querySelector('.container');
      if (!container) return;
      
      const existingAlert = document.querySelector('.alert-danger');
      if (existingAlert) existingAlert.remove();
      
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert alert-danger mt-3 fade-in';
      alertDiv.innerHTML = `
          <i class="fas fa-exclamation-circle me-2"></i>
          ${message}
      `;
      
      container.prepend(alertDiv);
        
      setTimeout(() => {
          alertDiv.remove();
      }, 5000);
  }

  // Fetch weather data
  async function fetchWeather(city) {
      try {
          showLoading(true);
          const apiKey = '2ec7aed112a5458e881154832253003';
          
          // Fetch current weather
          let currentResponse = await fetchWithTimeout(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}`);
          
          // If error, try with just city name
          if (!currentResponse?.ok) {
              const cityOnly = city.split(',')[0];
              currentResponse = await fetchWithTimeout(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${cityOnly}`);
          }
          
          if (!currentResponse?.ok) {
              throw new Error('City not found or API unavailable');
          }
          
          const currentData = await currentResponse.json();
          
          if (currentData.error) {
              throw new Error(currentData.error.message);
          }
          
          // Fetch forecast
          const forecastResponse = await fetchWithTimeout(`https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city}&days=7&aqi=yes`);
          
          if (!forecastResponse?.ok) {
              throw new Error('Forecast data unavailable');
          }
          
          const forecastData = await forecastResponse.json();
          
          if (forecastData.error) {
              throw new Error(forecastData.error.message);
          }
          
          // Update UI
          updateWeatherUI(currentData, city);
          updateForecastUI(forecastData);
          updateWeatherMap(weatherElements.mapLayer.value);
          
          // Center map on this location if available
          if (weatherMap && currentData.location) {
              weatherMap.setView(
                  [currentData.location.lat, currentData.location.lon], 
                  8
              );
          }
          
          // Update last updated time
          safeUpdateElement(weatherElements.lastUpdated, new Date().toLocaleTimeString());
          
      } catch (error) {
          console.error('Error fetching weather:', error);
          showError(`Failed to load weather data: ${error.message}`);
      } finally {
          showLoading(false);
      }
  }
  
  // Fetch air quality data
  async function fetchAirQuality(city) {
      try {
          const apiKey = '2ec7aed112a5458e881154832253003';
          const response = await fetchWithTimeout(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&aqi=yes`);
          
          if (!response?.ok) {
              throw new Error('Air quality data unavailable');
          }
          
          const data = await response.json();
          
          if (data.error) {
              throw new Error(data.error.message);
          }
          
          updateAirQualityUI(data.current.air_quality);
          
      } catch (error) {
          console.error('Error fetching air quality:', error);
          safeUpdateElement(weatherElements.aqiStatus, 'Air quality data unavailable');
      }
  }
  
  // Fetch pollen data (mock - as most APIs require premium for this)
  async function fetchPollenData(city) {
      try {
          // In a real app, you would use an API like Tomorrow.io or Climacell
          // This is a mock implementation
          const pollenData = {
              tree: Math.floor(Math.random() * 10) + 1,
              grass: Math.floor(Math.random() * 8) + 1,
              weed: Math.floor(Math.random() * 6) + 1
          };
          
          updatePollenUI(pollenData);
          
      } catch (error) {
          console.error('Error fetching pollen data:', error);
      }
  }
  
  // Update weather UI
  function updateWeatherUI(data, originalQuery) {
      // Special handling for Delhi
      let displayLocation;
      if (originalQuery.toLowerCase().includes('delhi') || 
          (data.location.name.toLowerCase() === 'delhi' && data.location.country.toLowerCase() !== 'india')) {
          displayLocation = 'Delhi, India';
      } else {
          displayLocation = `${data.location.name}, ${data.location.country}`;
      }
      
      safeUpdateElement(cityName, displayLocation);
      
      // Current weather data
      safeUpdateElement(weatherElements.temp, `${data.current.temp_c}°C`);
      safeUpdateElement(weatherElements.feels_like, `${data.current.feelslike_c}°C`);
      safeUpdateElement(weatherElements.humidity, `${data.current.humidity}%`);
      safeUpdateElement(weatherElements.cloud_pct, `${data.current.cloud}%`);
      safeUpdateElement(weatherElements.wind_speed, `${data.current.wind_kph} km/h`);
      safeUpdateElement(weatherElements.wind_degrees, `${data.current.wind_degree}°`);
      safeUpdateElement(weatherElements.conditionText, data.current.condition.text);
      
      // Weather icon
      if (weatherElements.weatherIcon) {
          weatherElements.weatherIcon.className = getWeatherIconClass(data.current.condition.text, data.current.is_day);
      }
  }
  
  // Update forecast UI
  function updateForecastUI(data) {
      // Hourly forecast
      if (weatherElements.hourlyForecast) {
          weatherElements.hourlyForecast.innerHTML = '';
          const hours = data.forecast.forecastday[0].hour;
          
          hours.forEach(hour => {
              const hourItem = document.createElement('div');
              hourItem.className = 'hour-item fade-in';
              hourItem.innerHTML = `
                  <div>${new Date(hour.time).getHours()}:00</div>
                  <div><i class="${getWeatherIconClass(hour.condition.text, hour.is_day)}"></i></div>
                  <div>${hour.temp_c}°C</div>
              `;
              weatherElements.hourlyForecast.appendChild(hourItem);
          });
      }
      
      // Daily forecast
      if (weatherElements.dailyForecast) {
          weatherElements.dailyForecast.innerHTML = '';
          const days = data.forecast.forecastday;
          
          days.forEach(day => {
              const dayItem = document.createElement('div');
              dayItem.className = 'day-item fade-in';
              dayItem.innerHTML = `
                  <div>
                      <strong>${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</strong>
                      <small>${new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>
                  </div>
                  <div>
                      <i class="${getWeatherIconClass(day.day.condition.text, 1)}"></i>
                  </div>
                  <div>
                      <span class="max-temp">${day.day.maxtemp_c}°</span> / 
                      <span class="min-temp">${day.day.mintemp_c}°</span>
                  </div>
              `;
              weatherElements.dailyForecast.appendChild(dayItem);
          });
      }
      
      // UV Index
      const uvIndex = data.forecast.forecastday[0].day.uv;
      safeUpdateElement(weatherElements.uvIndex, uvIndex);
      
      // Set UV progress bar
      if (weatherElements.uvProgress) {
          const uvPercentage = Math.min((uvIndex / 12) * 100, 100);
          weatherElements.uvProgress.style.width = `${uvPercentage}%`;
          
          // Set color based on UV index
          if (uvIndex <= 2) {
              weatherElements.uvProgress.style.background = '#4CAF50';
              safeUpdateElement(weatherElements.uvRecommendation, 'Low risk. Enjoy the sun!');
          } else if (uvIndex <= 5) {
              weatherElements.uvProgress.style.background = '#FFC107';
              safeUpdateElement(weatherElements.uvRecommendation, 'Moderate risk. Wear sunscreen.');
          } else if (uvIndex <= 7) {
              weatherElements.uvProgress.style.background = '#FF9800';
              safeUpdateElement(weatherElements.uvRecommendation, 'High risk. Seek shade during midday.');
          } else if (uvIndex <= 10) {
              weatherElements.uvProgress.style.background = '#F44336';
              safeUpdateElement(weatherElements.uvRecommendation, 'Very high risk. Extra protection needed.');
          } else {
              weatherElements.uvProgress.style.background = '#9C27B0';
              safeUpdateElement(weatherElements.uvRecommendation, 'Extreme risk. Avoid sun exposure.');
          }
      }
      
      // Sunrise/Sunset
      const astro = data.forecast.forecastday[0].astro;
      safeUpdateElement(weatherElements.sunrise, astro.sunrise);
      safeUpdateElement(weatherElements.sunset, astro.sunset);
      
      // Moon phase
      if (weatherElements.moonPhase) {
          weatherElements.moonPhase.textContent = astro.moon_phase;
          
          // Set moon icon based on phase
          const moonPhase = astro.moon_phase.toLowerCase();
          if (moonPhase.includes('new')) {
              weatherElements.moonIcon.className = 'fas fa-moon';
          } else if (moonPhase.includes('waxing crescent')) {
              weatherElements.moonIcon.className = 'fas fa-moon waxing-crescent';
          } else if (moonPhase.includes('first quarter')) {
              weatherElements.moonIcon.className = 'fas fa-moon first-quarter';
          } else if (moonPhase.includes('waxing gibbous')) {
              weatherElements.moonIcon.className = 'fas fa-moon waxing-gibbous';
          } else if (moonPhase.includes('full')) {
              weatherElements.moonIcon.className = 'fas fa-moon';
          } else if (moonPhase.includes('waning gibbous')) {
              weatherElements.moonIcon.className = 'fas fa-moon waning-gibbous';
          } else if (moonPhase.includes('last quarter')) {
              weatherElements.moonIcon.className = 'fas fa-moon last-quarter';
          } else if (moonPhase.includes('waning crescent')) {
              weatherElements.moonIcon.className = 'fas fa-moon waning-crescent';
          } else {
              weatherElements.moonIcon.className = 'fas fa-moon';
          }
      }
  }
  
  // Update air quality UI
  function updateAirQualityUI(airQuality) {
      // Calculate overall AQI (US EPA standard)
      const aqi = Math.max(
          airQuality.pm2_5, 
          airQuality.pm10, 
          airQuality.o3, 
          airQuality.no2, 
          airQuality.so2, 
          airQuality.co
      );
      
      safeUpdateElement(weatherElements.aqiValue, Math.round(aqi));
      
      // Set AQI status
      let aqiStatus, aqiColor;
      if (aqi <= 50) {
          aqiStatus = 'Good';
          aqiColor = '#4CAF50';
      } else if (aqi <= 100) {
          aqiStatus = 'Moderate';
          aqiColor = '#FFC107';
      } else if (aqi <= 150) {
          aqiStatus = 'Unhealthy for Sensitive Groups';
          aqiColor = '#FF9800';
      } else if (aqi <= 200) {
          aqiStatus = 'Unhealthy';
          aqiColor = '#F44336';
      } else if (aqi <= 300) {
          aqiStatus = 'Very Unhealthy';
          aqiColor = '#9C27B0';
      } else {
          aqiStatus = 'Hazardous';
          aqiColor = '#795548';
      }
      
      safeUpdateElement(weatherElements.aqiStatus, aqiStatus);
      if (weatherElements.aqiValue) {
          weatherElements.aqiValue.style.color = aqiColor;
      }
      
      // Update AQI details
      if (weatherElements.aqiDetails) {
          weatherElements.aqiDetails.innerHTML = `
              <div class="aqi-detail">
                  <span>PM2.5</span>
                  <span>${airQuality.pm2_5.toFixed(1)} µg/m³</span>
              </div>
              <div class="aqi-detail">
                  <span>PM10</span>
                  <span>${airQuality.pm10.toFixed(1)} µg/m³</span>
              </div>
              <div class="aqi-detail">
                  <span>O₃</span>
                  <span>${airQuality.o3.toFixed(1)} µg/m³</span>
              </div>
              <div class="aqi-detail">
                  <span>NO₂</span>
                  <span>${airQuality.no2.toFixed(1)} µg/m³</span>
              </div>
              <div class="aqi-detail">
                  <span>SO₂</span>
                  <span>${airQuality.so2.toFixed(1)} µg/m³</span>
              </div>
              <div class="aqi-detail">
                  <span>CO</span>
                  <span>${airQuality.co.toFixed(1)} ppm</span>
              </div>
          `;
      }
  }

  // Add animation to cards on load
  document.querySelectorAll('.glass-card').forEach((card, index) => {
      card.style.animationDelay = `${index * 0.1}s`;
      card.classList.add('fade-in');
  });
});