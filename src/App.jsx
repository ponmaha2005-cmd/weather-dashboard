import { useState, useEffect } from "react";

const CODES = {
  0: ["☀️", "Clear sky"],
  1: ["🌤️", "Mainly clear"],
  2: ["⛅", "Partly cloudy"],
  3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"],
  48: ["🌫️", "Fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌦️", "Heavy drizzle"],
  61: ["🌧️", "Light rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  71: ["🌨️", "Light snow"],
  73: ["🌨️", "Snow"],
  75: ["🌨️", "Heavy snow"],
  80: ["🌦️", "Rain showers"],
  81: ["🌧️", "Rain showers"],
  82: ["⛈️", "Violent showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Thunderstorm with hail"],
  99: ["⛈️", "Thunderstorm with hail"],
};

function describe(code, isDay = 1) {
  if (!isDay) {
    if (code === 0) return ["🌙", "Clear night"];
    if (code === 1) return ["🌙", "Mainly clear"];
    if (code === 2) return ["☁️", "Partly cloudy"];
  }
  return CODES[code] || ["🌡️", "Unknown"];
}

function formatTime(iso) {
  const h = Number(iso.slice(11, 13));
  const m = iso.slice(14, 16);
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

function formatHour(iso) {
  const h = Number(iso.slice(11, 13));
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
}

function load(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_PLACE = {
  name: "Chennai",
  country: "India",
  latitude: 13.0878,
  longitude: 80.2785,
};

function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [place, setPlace] = useState(DEFAULT_PLACE);
  const [unit, setUnit] = useState("celsius");
  const [weatherData, setWeatherData] = useState(null);
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState(() => load("favorites", []));
  const [theme, setTheme] = useState(() => load("theme", "light"));

  useEffect(() => {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("theme", JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5`
        );
        const data = await res.json();
        setSuggestions(data.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const key = `${place.latitude},${place.longitude},${unit}`;

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,surface_pressure,weather_code,is_day&hourly=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max&timezone=auto&forecast_days=7&temperature_unit=${unit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        if (!cancelled) {
          setWeatherData({ key, data });
          setError("");
        }
      } catch {
        if (!cancelled) setError("Could not load weather. Check your internet.");
      }
    }
    loadWeather();
    return () => {
      cancelled = true;
    };
  }, [place, unit, key]);

  function selectPlace(p) {
    setPlace(p);
    setQuery("");
    setSuggestions([]);
    setError("");
  }

  async function searchCity(e) {
    e.preventDefault();
    if (!query.trim()) return;
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=1`
      );
      const data = await res.json();
      if (!data.results) {
        setError("City not found");
        return;
      }
      selectPlace(data.results[0]);
    } catch {
      setError("Something went wrong. Check your internet.");
    }
  }

  function getMyLocation() {
    if (!navigator.geolocation) {
      setError("Location is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        selectPlace({
          name: "My Location",
          country: "",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => setError("Location permission denied.")
    );
  }

  const isFav = favorites.some(
    (f) => f.latitude === place.latitude && f.longitude === place.longitude
  );

  function toggleFavorite() {
    if (isFav) {
      setFavorites(
        favorites.filter(
          (f) => !(f.latitude === place.latitude && f.longitude === place.longitude)
        )
      );
    } else {
      setFavorites([
        ...favorites,
        {
          name: place.name,
          country: place.country,
          latitude: place.latitude,
          longitude: place.longitude,
        },
      ]);
    }
  }

  const symbol = unit === "celsius" ? "°C" : "°F";
  const loading = !weatherData || weatherData.key !== key;
  const weather = !loading ? weatherData.data : null;
  const placeName = place.country ? `${place.name}, ${place.country}` : place.name;

  let hours = [];
  if (weather) {
    const h = weather.hourly;
    const start = Math.max(
      0,
      h.time.findIndex((t) => t.slice(0, 13) === weather.current.time.slice(0, 13))
    );
    hours = h.time.slice(start, start + 24).map((t, i) => ({
      time: t,
      temp: h.temperature_2m[start + i],
      code: h.weather_code[start + i],
      isDay: h.is_day[start + i],
    }));
  }

  return (
    <div className={`app ${theme}`}>
      <div className="container">
        <header>
          <h1>Weather Dashboard</h1>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
        </header>

        <form className="search" onSubmit={searchCity}>
          <div className="search-box">
            <input
              placeholder="Search city (e.g. Chennai)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim().length >= 2 && suggestions.length > 0 && (
              <ul className="suggestions">
                {suggestions.map((s) => (
                  <li key={s.id} onClick={() => selectPlace(s)}>
                    {s.name}
                    {s.admin1 ? `, ${s.admin1}` : ""}, {s.country}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="submit">Search</button>
          <button type="button" className="secondary" onClick={getMyLocation}>
            📍
          </button>
          <button
            type="button"
            className="unit-btn"
            onClick={() => setUnit(unit === "celsius" ? "fahrenheit" : "celsius")}
          >
            {unit === "celsius" ? "°F" : "°C"}
          </button>
        </form>

        {favorites.length > 0 && (
          <div className="chips">
            {favorites.map((f) => (
              <button
                key={`${f.latitude},${f.longitude}`}
                className="chip"
                onClick={() => selectPlace(f)}
              >
                ⭐ {f.name}
              </button>
            ))}
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {loading && !error && <p className="loading">Loading...</p>}

        {weather && (
          <>
            <div className="card current">
              <div className="current-top">
                <h2>{placeName}</h2>
                <button className="fav-btn" onClick={toggleFavorite}>
                  {isFav ? "★" : "☆"}
                </button>
              </div>
              <div className="big-icon">
                {describe(weather.current.weather_code, weather.current.is_day)[0]}
              </div>
              <p className="temp">
                {Math.round(weather.current.temperature_2m)}
                {symbol}
              </p>
              <p className="desc">
                {describe(weather.current.weather_code, weather.current.is_day)[1]}
              </p>

              <div className="details">
                <div>
                  Feels like
                  <strong>
                    {Math.round(weather.current.apparent_temperature)}
                    {symbol}
                  </strong>
                </div>
                <div>
                  Humidity
                  <strong>{weather.current.relative_humidity_2m}%</strong>
                </div>
                <div>
                  Wind
                  <strong>{weather.current.wind_speed_10m} km/h</strong>
                </div>
                <div>
                  Pressure
                  <strong>{Math.round(weather.current.surface_pressure)} hPa</strong>
                </div>
                <div>
                  Sunrise
                  <strong>{formatTime(weather.daily.sunrise[0])}</strong>
                </div>
                <div>
                  Sunset
                  <strong>{formatTime(weather.daily.sunset[0])}</strong>
                </div>
              </div>
            </div>

            <h3>Next 24 Hours</h3>
            <div className="hourly">
              {hours.map((h) => (
                <div className="card hour" key={h.time}>
                  <span>{formatHour(h.time)}</span>
                  <div className="icon">{describe(h.code, h.isDay)[0]}</div>
                  <strong>
                    {Math.round(h.temp)}
                    {symbol}
                  </strong>
                </div>
              ))}
            </div>

            <h3>7-Day Forecast</h3>
            <div className="forecast">
              {weather.daily.time.map((day, i) => (
                <div className="card day" key={day}>
                  <strong>
                    {i === 0
                      ? "Today"
                      : new Date(day).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                        })}
                  </strong>
                  <div className="icon">{describe(weather.daily.weather_code[i])[0]}</div>
                  <p>
                    {Math.round(weather.daily.temperature_2m_max[i])}
                    {symbol}
                  </p>
                  <span>
                    {Math.round(weather.daily.temperature_2m_min[i])}
                    {symbol}
                  </span>
                  <small>🌧 {weather.daily.precipitation_probability_max[i] ?? 0}%</small>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;