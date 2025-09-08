import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { Card, Button, Modal, Checkbox } from '../components';
import { Task, TaskStatus, CalendarEvent, User as FrontendUser } from '../types';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon, TASK_EVENT_COLOR } from '../constants';
import { calendarService } from '../calendarService';

// Helper to get YYYY-MM-DD string in local timezone
const localISOString = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MiniCalendar: React.FC<{ date: Date, setDate: (date: Date) => void, events: CalendarEvent[] }> = ({ date, setDate, events }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(date.getFullYear(), date.getMonth(), 1));

  useEffect(() => {
    const newCurrentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    if (newCurrentMonth.getTime() !== currentMonth.getTime()) {
        setCurrentMonth(newCurrentMonth);
    }
  }, [date, currentMonth]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const today = new Date();
  const todayLocalString = localISOString(today);

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const numDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const daysArray: (Date | null)[] = Array(firstDay).fill(null);

    for (let i = 1; i <= numDays; i++) {
      daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  const calendarDays = generateCalendarDays();
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const handleToday = () => {
      const newToday = new Date();
      setCurrentMonth(new Date(newToday.getFullYear(), newToday.getMonth(), 1));
      setDate(newToday);
  }

  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <button onClick={handlePrevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-dark"><ChevronLeftIcon className="w-5 h-5" /></button>
        <span className="font-semibold text-sm calendar-header">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button onClick={handleNextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-dark"><ChevronRightIcon className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted dark:text-muted-dark calendar-muted mb-2">
        {dayNames.map(day => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (!day) return <div key={`empty-${index}`}></div>;
          const dayLocalString = localISOString(day);
          const isSelected = dayLocalString === localISOString(date);
          const isToday = dayLocalString === todayLocalString;
          const hasEvent = events.some(event => event.date === dayLocalString);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setDate(day)}
              className={`p-1 text-xs rounded text-center relative calendar-date
                ${isSelected ? 'bg-primary text-white' : isToday ? 'bg-primary-light/30 text-primary dark:text-indigo-300' : 'hover:bg-gray-100 dark:hover:bg-surface-dark text-text dark:text-text-dark'}
              `}
            >
              {day.getDate()}
              {hasEvent && <span className={`absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : `bg-${TASK_EVENT_COLOR.split('-')[0]}-500`}`}></span>}
            </button>
          );
        })}
      </div>
      <Button variant="outline" size="sm" className="w-full mt-3" onClick={handleToday}>Today</Button>
    </Card>
  );
};

type CalendarViewType = 'Month' | 'Week' | 'Day';

const MainCalendarView: React.FC<{
    date: Date,
    events: CalendarEvent[],
    onDateClick: (date: Date) => void,
    onEventClick: (event: CalendarEvent) => void,
    setDate: (date: Date) => void,
    currentView: CalendarViewType
}> = ({ date, events, onDateClick, onEventClick, setDate, currentView }) => {

  const [currentDisplayDate, setCurrentDisplayDate] = useState(new Date(date.getFullYear(), date.getMonth(), date.getDate()));

  useEffect(() => {
      const newDisplayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (newDisplayDate.getTime() !== currentDisplayDate.getTime()) {
          setCurrentDisplayDate(newDisplayDate);
      }
  }, [date, currentDisplayDate]);

  const today = new Date();
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handlePrev = () => {
    let newDate;
    if (currentView === 'Month') {
      newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() - 1, 1);
    } else if (currentView === 'Week') {
      newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), currentDisplayDate.getDate() - 7);
    } else { // Day
      newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), currentDisplayDate.getDate() - 1);
    }
    setCurrentDisplayDate(newDate);
    setDate(newDate);
  };

  const handleNext = () => {
    let newDate;
    if (currentView === 'Month') {
      newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 1);
    } else if (currentView === 'Week') {
      newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), currentDisplayDate.getDate() + 7);
    } else { // Day
      newDate = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), currentDisplayDate.getDate() + 1);
    }
    setCurrentDisplayDate(newDate);
    setDate(newDate);
  };

  const getMonthViewTitle = () => currentDisplayDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getWeekViewTitle = () => {
      const startOfWeek = new Date(currentDisplayDate);
      startOfWeek.setDate(currentDisplayDate.getDate() - currentDisplayDate.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
          return `${startOfWeek.toLocaleString('default', { month: 'long' })} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      } else if (startOfWeek.getFullYear() === endOfWeek.getFullYear()) {
          return `${startOfWeek.toLocaleString('default', { month: 'short' })} ${startOfWeek.getDate()} - ${endOfWeek.toLocaleString('default', { month: 'short' })} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
      } else {
          return `${localISOString(startOfWeek)} - ${localISOString(endOfWeek)}`;
      }
  };

  const getDayViewTitle = () => currentDisplayDate.toLocaleString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const currentTitle = currentView === 'Month' ? getMonthViewTitle() : currentView === 'Week' ? getWeekViewTitle() : getDayViewTitle();

  const renderMonthView = () => {
    const year = currentDisplayDate.getFullYear();
    const month = currentDisplayDate.getMonth();
    const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const firstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const numDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const gridCells: { dateObj: Date; events: CalendarEvent[]; isCurrentMonth: boolean }[] = [];

    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const numDaysPrevMonth = daysInMonth(prevMonthYear, prevMonthIdx);
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayOfPrevMonth = numDaysPrevMonth - i;
        const prevDateObj = new Date(prevMonthYear, prevMonthIdx, dayOfPrevMonth);
        gridCells.push({dateObj: prevDateObj, events: events.filter(e => e.date === localISOString(prevDateObj)), isCurrentMonth: false});
    }

    for (let i = 1; i <= numDays; i++) {
      const dayDate = new Date(year, month, i);
      gridCells.push({ dateObj: dayDate, events: events.filter(event => event.date === localISOString(dayDate)), isCurrentMonth: true });
    }

    const totalCells = gridCells.length <= 35 ? 35 : 42; // Ensure 5 or 6 rows
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    for (let i = 1; gridCells.length < totalCells; i++) {
        const nextDateObj = new Date(nextMonthYear, nextMonthIdx, i);
        gridCells.push({dateObj: nextDateObj, events: events.filter(e => e.date === localISOString(nextDateObj)), isCurrentMonth: false});
    }

    return (
      <div className="grid grid-cols-7 border-t border-l border-gray-200 dark:border-border-dark">
        {dayNamesFull.map(dayName => (
          <div key={dayName} className="p-2 text-center text-xs font-medium text-muted dark:text-muted-dark calendar-header border-b border-r border-gray-200 dark:border-border-dark h-10 flex items-center justify-center">{dayName}</div>
        ))}
        {gridCells.map(({ dateObj, events: dayEvents, isCurrentMonth: cellIsCurrentMonth }) => {
          const isToday = localISOString(dateObj) === localISOString(today);
          const isSelected = localISOString(dateObj) === localISOString(date);

          return (
            <div
              key={dateObj.toISOString()}
              onClick={() => { onDateClick(dateObj); setDate(dateObj); }}
              className={`p-2 border-b border-r border-gray-200 dark:border-border-dark min-h-[100px] cursor-pointer relative ${!cellIsCurrentMonth ? 'bg-surface dark:bg-surface-dark/30 text-gray-400 dark:text-gray-500' : 'hover:bg-surface dark:hover:bg-surface-dark/50'} ${isSelected ? 'bg-primary-light/10 dark:bg-primary-dark/20 ring-1 ring-primary' : ''}`}
            >
              <span className={`text-sm calendar-date ${isToday ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-text dark:text-text-dark'}`}>{dateObj.getDate()}</span>
              <div className="mt-1 space-y-1 overflow-y-auto max-h-[70px]">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                    className={`text-xs p-1 rounded truncate bg-${event.color}/20 text-${event.color.split('-')[0]}-600 dark:text-${event.color.split('-')[0]}-300 border border-${event.color}/50 dark:bg-${event.color}/30`}
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDates: Date[] = [];
    const startOfWeek = new Date(currentDisplayDate);
    startOfWeek.setDate(currentDisplayDate.getDate() - currentDisplayDate.getDay()); // Sunday
    for (let i = 0; i < 7; i++) {
        const dayInWeek = new Date(startOfWeek);
        dayInWeek.setDate(startOfWeek.getDate() + i);
        weekDates.push(dayInWeek);
    }
    return (
        <div className="grid grid-cols-7 border-t border-l border-gray-200 dark:border-border-dark">
            {weekDates.map(day => {
                const dayLocalStr = localISOString(day);
                const dayEvents = events.filter(e => e.date === dayLocalStr);
                const isToday = localISOString(day) === localISOString(today);
                const isSelected = localISOString(day) === localISOString(date);

                return (
                    <div key={dayLocalStr} className={`p-2 border-b border-r border-gray-200 dark:border-border-dark min-h-[150px] ${isSelected ? 'bg-primary-light/10 dark:bg-primary-dark/20' : ''}`}>
                        <div className="flex justify-between items-center">
                           <span className={`text-sm font-medium calendar-date ${isToday ? 'bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-text dark:text-text-dark'}`}>{day.getDate()}</span>
                           <span className="text-xs text-muted dark:text-muted-dark calendar-muted">{dayNamesFull[day.getDay()].substring(0,3)}</span>
                        </div>
                        <div className="mt-2 space-y-1 overflow-y-auto max-h-[120px]">
                            {dayEvents.map(event => (
                                <div key={event.id} onClick={() => onEventClick(event)} className={`text-xs p-1 rounded truncate bg-${event.color}/20 text-${event.color.split('-')[0]}-600 dark:text-${event.color.split('-')[0]}-300 border border-${event.color}/50 dark:bg-${event.color}/30 cursor-pointer`}>
                                    {event.startTime && <span className="font-semibold">{event.startTime} </span>}{event.title}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  const renderDayView = () => {
    const dayLocalStr = localISOString(currentDisplayDate);
    const dayEvents = events.filter(e => e.date === dayLocalStr).sort((a,b) => {
        if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.startTime) return -1; // Events with start time first
        if (b.startTime) return 1;
        return 0; // All-day events or events without start time
    });
    return (
        <div className="p-4 border-t border-gray-200 dark:border-border-dark">
            {dayEvents.length === 0 ? (
                <p className="text-muted dark:text-muted-dark calendar-muted text-center py-10">No events scheduled for this day.</p>
            ) : (
                <div className="space-y-3">
                    {dayEvents.map(event => (
                         <div key={event.id} onClick={() => onEventClick(event)} className={`p-3 rounded-lg flex items-start space-x-3 bg-${event.color}/10 dark:bg-${event.color}/20 border border-${event.color}/30 cursor-pointer`}>
                            {event.startTime && <p className={`w-20 text-sm font-semibold text-${event.color.split('-')[0]}-700 dark:text-${event.color.split('-')[0]}-200`}>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}</p>}
                            <div className="flex-grow">
                                <p className={`font-medium text-text dark:text-text-dark`}>{event.title}</p>
                                {event.calendarType && <p className="text-xs text-muted dark:text-muted-dark calendar-muted capitalize">{event.calendarType}</p>}
                                {event.description && <p className="text-xs text-muted dark:text-muted-dark mt-1">{event.description}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
  };

  return (
    <Card className="flex-grow p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <button onClick={handlePrev} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-surface-dark"><ChevronLeftIcon className="w-6 h-6" /></button>
          <h2 className="text-xl font-semibold text-text dark:text-text-dark calendar-header">{currentTitle}</h2>
          <button onClick={handleNext} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-surface-dark"><ChevronRightIcon className="w-6 h-6" /></button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto">
        {currentView === 'Month' && renderMonthView()}
        {currentView === 'Week' && renderWeekView()}
        {currentView === 'Day' && renderDayView()}
      </div>
    </Card>
  );
};

interface CalendarPageProps {
  appTasks: Task[];
  currentUser: FrontendUser | null;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ appTasks, currentUser }) => {
  const initialDate = new Date(); // Use today's date
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);

  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [errorEvents, setErrorEvents] = useState<string | null>(null);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showTasksOnCalendar, setShowTasksOnCalendar] = useState(true);
  const [currentCalendarViewType, setCurrentCalendarViewType] = useState<CalendarViewType>('Month');

  const [newEventForm, setNewEventForm] = useState<Partial<CalendarEvent>>({
    title: '',
    date: localISOString(selectedDate),
    startTime: '10:00',
    endTime: '11:00',
    color: 'blue-500',
    calendarType: 'work',
    description: '',
    projectId: '',
    taskId: ''
  });

  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      fetchCalendarEvents();
    } else {
      setLocalEvents([]);
      setIsLoadingEvents(false);
    }
  }, [currentUser]);

  const fetchCalendarEvents = async () => {
    if (!currentUser) return;
    setIsLoadingEvents(true);
    setErrorEvents(null);
    try {
      const events = await calendarService.getAllEventsForUser();
      setLocalEvents(events);
    } catch (err) {
      console.error("Error fetching calendar events:", err);
      setErrorEvents("Failed to load calendar events.");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    // When selectedDate changes, update the date in the new event form if not editing
    if (!editingEvent) {
        setNewEventForm(prev => ({...prev, date: localISOString(selectedDate)}));
    }
  }, [selectedDate, editingEvent]);

  const calendarTypesForCheckboxes = ['work', 'personal', 'family']; // Types user can directly create/filter

  const [selectedCalendarTypes, setSelectedCalendarTypes] = useState<string[]>(() => {
    const initialTypes = ['work', 'personal', 'family'];
    if (showTasksOnCalendar) {
      initialTypes.push('tasks');
    }
    return initialTypes;
  });

  useEffect(() => {
    // Sync selectedCalendarTypes with showTasksOnCalendar toggle
    setSelectedCalendarTypes(prevTypes => {
      const baseTypes = prevTypes.filter(t => t !== 'tasks');
      if (showTasksOnCalendar) {
        return [...baseTypes, 'tasks'];
      }
      return baseTypes;
    });
  }, [showTasksOnCalendar]);


  const combinedEvents = useMemo(() => {
    let allEvents: CalendarEvent[] = [...localEvents];

    if (showTasksOnCalendar) {
      const taskEvents: CalendarEvent[] = appTasks
        .filter(task => task.dueDate && task.status !== TaskStatus.COMPLETED) // Only show non-completed tasks with due dates
        .map(task => ({
          id: `task-${task.id}`,
          title: task.title,
          date: task.dueDate, // Assuming dueDate is in YYYY-MM-DD format
          color: TASK_EVENT_COLOR, // Use a consistent color for tasks
          calendarType: 'tasks', // Special type for tasks
          userId: currentUser?.id, // Associate with current user
          taskId: task.id, // Link event to task
          description: task.description,
        }));
      allEvents = [...allEvents, ...taskEvents];
    }

    return allEvents.filter(event => selectedCalendarTypes.includes(event.calendarType));
  }, [localEvents, appTasks, showTasksOnCalendar, selectedCalendarTypes, currentUser]);


  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.id.startsWith('task-')) {
      // Optionally, navigate to task details or show a summary
      alert(`Task: ${event.title}\nDue: ${event.date}\n(Manage tasks from the Tasks page)`);
      return;
    }
    setEditingEvent(event);
    setNewEventForm({
        title: event.title,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        color: event.color,
        calendarType: event.calendarType,
        description: event.description || '',
        projectId: event.projectId || '',
        taskId: event.taskId || '',
    });
    setIsEventModalOpen(true);
  };

  const handleOpenAddEventModal = () => {
    setEditingEvent(null);
    setNewEventForm({
        title: '',
        date: localISOString(selectedDate),
        startTime: '10:00',
        endTime: '11:00',
        color: 'blue-500',
        calendarType: 'work',
        description: '',
        projectId: '',
        taskId: ''
    });
    setIsEventModalOpen(true);
  }

  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!currentUser) {
        setErrorEvents("User not authenticated.");
        return;
    }

    const eventPayload: Partial<CalendarEvent> = {
      ...newEventForm,
      date: newEventForm.date || localISOString(new Date()), // Ensure date is set
      projectId: newEventForm.projectId || undefined, // Ensure empty string becomes undefined for Supabase
      taskId: newEventForm.taskId || undefined,
    };
    if (eventPayload.projectId === '') delete eventPayload.projectId;
    if (eventPayload.taskId === '') delete eventPayload.taskId;


    try {
        if (editingEvent) {
            const updatedEvent = await calendarService.updateEvent(editingEvent.id, eventPayload);
            setLocalEvents(prev => prev.map(ev => ev.id === editingEvent.id ? updatedEvent : ev));
        } else {
            const newDbEvent = await calendarService.createEvent({ ...eventPayload, userId: currentUser.id } as CalendarEvent & { userId: string});
            setLocalEvents(prev => [newDbEvent, ...prev]);
        }
        setIsEventModalOpen(false);
        setEditingEvent(null);
    } catch (err) {
        console.error("Error saving event:", err);
        setErrorEvents("Failed to save event.");
    }
  };

  const handleEventFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewEventForm(prev => ({...prev, [name]: value}));
  };

  const handleCalendarTypeToggle = (type: string) => {
    setSelectedCalendarTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleOpenDeleteConfirmModal = (eventId: string) => {
    setEventToDeleteId(eventId);
    setIsDeleteConfirmModalOpen(true);
  };

  const handleCloseDeleteConfirmModal = () => {
    setEventToDeleteId(null);
    setIsDeleteConfirmModalOpen(false);
  };

  const handleConfirmDeleteEvent = async () => {
    if (eventToDeleteId) {
      try {
        await calendarService.deleteEvent(eventToDeleteId);
        setLocalEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDeleteId));
        handleCloseDeleteConfirmModal();
        setIsEventModalOpen(false); // Also close the edit modal if it was open
        setEditingEvent(null);
      } catch (error) {
        console.error("Error deleting event:", error);
        setErrorEvents("Failed to delete event.");
      }
    }
  };

  if (isLoadingEvents) {
    return <div className="flex items-center justify-center h-full text-text dark:text-text-dark">Loading calendar events...</div>;
  }
  if (errorEvents && !currentUser) { // Show error if not logged in and error occurs
    return <div className="flex items-center justify-center h-full text-red-500">{errorEvents} Please ensure you are logged in.</div>;
  }


  return (
    <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-6 h-full">
      <div className="w-full md:w-72 flex-shrink-0 space-y-4">
        <Button onClick={handleOpenAddEventModal} leftIcon={<PlusIcon className="w-4 h-4" />} className="w-full">Add Event</Button>
        <MiniCalendar date={selectedDate} setDate={setSelectedDate} events={combinedEvents} />
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2 text-text dark:text-text-dark calendar-header">My Calendars</h3>
          {calendarTypesForCheckboxes.map(type => (
            <div key={type} className="flex items-center mb-1">
              <Checkbox
                checked={selectedCalendarTypes.includes(type)}
                onChange={() => handleCalendarTypeToggle(type)}
                label={type.charAt(0).toUpperCase() + type.slice(1)}
              />
            </div>
          ))}
           <div className="mt-3 border-t pt-3 dark:border-border-dark">
             <Checkbox
                checked={showTasksOnCalendar}
                onChange={setShowTasksOnCalendar}
                label="Show tasks on calendar"
              />
           </div>
        </Card>
        {errorEvents && <p className="text-sm text-red-500">{errorEvents}</p>}
      </div>
      <div className="flex-grow flex flex-col">
        <div className="flex justify-end space-x-2 mb-4">
            {(['Month', 'Week', 'Day'] as CalendarViewType[]).map(view => (
                <Button
                    key={view}
                    variant={currentCalendarViewType === view ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setCurrentCalendarViewType(view)}
                >
                    {view}
                </Button>
            ))}
        </div>
        <MainCalendarView
          date={selectedDate}
          events={combinedEvents}
          onDateClick={handleDateClick}
          onEventClick={handleEventClick}
          setDate={setSelectedDate}
          currentView={currentCalendarViewType}
        />
      </div>
      <Modal isOpen={isEventModalOpen} onClose={() => { setIsEventModalOpen(false); setEditingEvent(null); }} title={editingEvent ? "Edit Event" : "Add New Event"}>
        <form onSubmit={handleSaveEvent} className="space-y-4">
          <div>
            <label htmlFor="eventTitle" className="block text-sm font-medium text-muted dark:text-muted-dark calendar-muted">Title</label>
            <input type="text" name="title" id="eventTitle" value={newEventForm.title} onChange={handleEventFormChange} required className="mt-1 block w-full input-style"/>
          </div>
          <div>
            <label htmlFor="eventDate" className="block text-sm font-medium text-muted dark:text-muted-dark calendar-muted">Date</label>
            <input type="date" name="date" id="eventDate" value={newEventForm.date} onChange={handleEventFormChange} required className="mt-1 block w-full input-style"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startTime" className="block text-sm font-medium text-muted dark:text-muted-dark calendar-muted">Start Time</label>
              <input type="time" name="startTime" id="startTime" value={newEventForm.startTime || ''} onChange={handleEventFormChange} className="mt-1 block w-full input-style"/>
            </div>
            <div>
              <label htmlFor="endTime" className="block text-sm font-medium text-muted dark:text-muted-dark calendar-muted">End Time</label>
              <input type="time" name="endTime" id="endTime" value={newEventForm.endTime || ''} onChange={handleEventFormChange} className="mt-1 block w-full input-style"/>
            </div>
          </div>
           <div>
            <label htmlFor="eventDescription" className="block text-sm font-medium text-muted dark:text-muted-dark">Description</label>
            <textarea name="description" id="eventDescription" value={newEventForm.description || ''} onChange={handleEventFormChange} rows={3} className="mt-1 block w-full input-style"></textarea>
          </div>
          <div>
            <label htmlFor="calendarType" className="block text-sm font-medium text-muted dark:text-muted-dark calendar-muted">Calendar Type</label>
            <select name="calendarType" id="calendarType" value={newEventForm.calendarType} onChange={handleEventFormChange} className="mt-1 block w-full input-style">
              <option value="work">Work</option>
              <option value="personal">Personal</option>
              <option value="family">Family</option>
            </select>
          </div>
           <div>
            <label htmlFor="eventColor" className="block text-sm font-medium text-muted dark:text-muted-dark calendar-muted">Color (e.g., blue-500)</label>
            <input type="text" name="color" id="eventColor" value={newEventForm.color} onChange={handleEventFormChange} placeholder="blue-500" className="mt-1 block w-full input-style"/>
          </div>
          {/* TODO: Add project/task linking if necessary */}
          <div className="flex justify-between items-center pt-2">
            <div>
              {editingEvent && (
                <Button type="button" variant="danger" onClick={() => handleOpenDeleteConfirmModal(editingEvent.id)}>
                  Delete Event
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => { setIsEventModalOpen(false); setEditingEvent(null); }}>Cancel</Button>
              <Button type="submit">{editingEvent ? "Save Changes" : "Add Event"}</Button>
            </div>
          </div>
        </form>
      </Modal>
      <Modal isOpen={isDeleteConfirmModalOpen} onClose={handleCloseDeleteConfirmModal} title="Confirm Delete Event" size="sm">
        <p className="text-sm text-text dark:text-text-dark mb-6">
          Are you sure you want to delete this event? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleCloseDeleteConfirmModal}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirmDeleteEvent}>Confirm Delete</Button>
        </div>
      </Modal>
    </div>
  );
};