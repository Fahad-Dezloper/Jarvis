import { useState, useEffect } from "react";
import useCalendarStore from "../calendarStore";
import "../handlers";

const pad = (n) => String(n).padStart(2, "0");
const isoDay = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const useCalendar = () => {
  const [currentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [month, setMonth] = useState(currentDate.getMonth());
  const [year, setYear] = useState(currentDate.getFullYear());

  const [activeCategories, setActiveCategories] = useState({
    personal: true,
    work: true,
    birthdays: true,
    holidays: true,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => isoDay(0));
  const [eventStart, setEventStart] = useState("09:00");
  const [eventEnd, setEventEnd] = useState("10:00");
  const [eventCategory, setEventCategory] = useState("personal");
  const [eventDesc, setEventDesc] = useState("");

  const [dayEventsPopover, setDayEventsPopover] = useState(null);

  const events = useCalendarStore((st) => st.events);
  const setEvents = useCalendarStore((st) => st.setEvents);
  const focusDate = useCalendarStore((st) => st.focusDate);
  const clearFocus = useCalendarStore((st) => st.clearFocus);

  useEffect(() => {
    useCalendarStore.getState().hydrate();
  }, []);

  // A voice-added event brings its day into view.
  useEffect(() => {
    if (!focusDate) return;
    const [y, m, d] = focusDate.split("-").map(Number);
    setMonth(m - 1);
    setYear(y);
    setSelectedDate(new Date(y, m - 1, d));
    clearFocus();
  }, [focusDate]);

  const toggleCategory = (catId) => {
    setActiveCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayIndex = (y, m) => new Date(y, m, 1).getDay();

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((prev) => prev - 1);
    } else {
      setMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((prev) => prev + 1);
    } else {
      setMonth((prev) => prev + 1);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    setMonth(today.getMonth());
    setYear(today.getFullYear());
    setSelectedDate(today);
  };

  const generateGrid = () => {
    const totalDays = getDaysInMonth(year, month);
    const firstDayIndex = getFirstDayIndex(year, month);
    const prevMonthDaysCount = getDaysInMonth(year, month - 1 < 0 ? 11 : month - 1);
    const gridCells = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDaysCount - i;
      const prevM = month - 1 < 0 ? 11 : month - 1;
      const prevY = month - 1 < 0 ? year - 1 : year;
      gridCells.push({ dayNumber: d, date: new Date(prevY, prevM, d), isCurrentMonth: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      gridCells.push({ dayNumber: d, date: new Date(year, month, d), isCurrentMonth: true });
    }

    const totalCells = gridCells.length;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remainingCells; d++) {
      const nextM = month + 1 > 11 ? 0 : month + 1;
      const nextY = month + 1 > 11 ? year + 1 : year;
      gridCells.push({ dayNumber: d, date: new Date(nextY, nextM, d), isCurrentMonth: false });
    }

    return gridCells;
  };

  const gridCells = generateGrid();

  const getFilteredEvents = () => events.filter((event) => activeCategories[event.category]);
  const filteredEvents = getFilteredEvents();

  const getEventsForDate = (dateObj) => {
    const dateString = dateObj.toLocaleDateString("en-CA");
    return filteredEvents.filter((event) => event.date === dateString);
  };

  const handleAddEvent = (e) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    const newEvent = {
      id: Date.now().toString(),
      title: eventTitle,
      date: eventDate,
      start: eventStart,
      end: eventEnd,
      category: eventCategory,
      desc: eventDesc,
    };

    setEvents((prev) => [...prev, newEvent]);
    setIsModalOpen(false);
    setEventTitle("");
    setEventDesc("");
  };

  const handleDeleteEvent = (eventId) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    if (dayEventsPopover) {
      setDayEventsPopover((prev) => ({
        ...prev,
        events: prev.events.filter((ev) => ev.id !== eventId),
      }));
    }
  };

  const triggerAddEventOnDate = (dateObj) => {
    const formattedDate = dateObj.toLocaleDateString("en-CA");
    setEventDate(formattedDate);
    setIsModalOpen(true);
  };

  const isToday = (dateObj) => {
    const today = new Date();
    return (
      dateObj.getDate() === today.getDate() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (dateObj) => {
    return (
      dateObj.getDate() === selectedDate.getDate() &&
      dateObj.getMonth() === selectedDate.getMonth() &&
      dateObj.getFullYear() === selectedDate.getFullYear()
    );
  };

  return {
    month,
    year,
    selectedDate,
    isSidebarOpen,
    activeCategories,
    isModalOpen,
    eventTitle,
    eventDate,
    eventStart,
    eventEnd,
    eventCategory,
    eventDesc,
    dayEventsPopover,
    events,
    gridCells,
    filteredEvents,
    setMonth,
    setYear,
    setSelectedDate,
    setIsSidebarOpen,
    setActiveCategories,
    setIsModalOpen,
    setEventTitle,
    setEventDate,
    setEventStart,
    setEventEnd,
    setEventCategory,
    setEventDesc,
    setDayEventsPopover,
    setEvents,
    toggleCategory,
    handlePrevMonth,
    handleNextMonth,
    handleGoToToday,
    getEventsForDate,
    handleAddEvent,
    handleDeleteEvent,
    triggerAddEventOnDate,
    isToday,
    isSelected,
  };
};

export default useCalendar;
