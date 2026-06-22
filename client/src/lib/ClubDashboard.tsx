import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarPlus, Clock, MapPin, ChevronRight, Info, Users, AlertTriangle, RefreshCw, Plus } from 'lucide-react';
import { apiRequest, mapBooking, groupBookings, type ApiBooking, type ApiVenue } from './api';
import { getErrorMessage } from './errors';
import { Booking, AppEvent, User } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Calendar, type CalendarEvent } from '../components/ui/calendar';
import { Skeleton } from '../components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getSocket, SOCKET_EVENTS } from './socket';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface ClubDashboardProps {
  user: User;
}

const formatEventType = (eventType?: string) => {
  if (!eventType) return '';
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
};

type ScheduleCalendarCardProps = {
  title: string;
  headerAction?: React.ReactNode;
  selectedDate?: Date;
  onSelectDate: (date?: Date) => void;
  sourceEvents: Booking[];
  calendarEvents: CalendarEvent[];
  eventDates: Date[];
  venues: ApiVenue[];
  emptyMessage: string;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
};

const ScheduleCalendarCard = ({
  title,
  headerAction,
  selectedDate,
  onSelectDate,
  sourceEvents,
  calendarEvents,
  eventDates,
  venues,
  emptyMessage,
}: ScheduleCalendarCardProps) => {
  const selectedDateEvents = selectedDate
    ? sourceEvents.filter(event => isSameDay(new Date(event.date), selectedDate))
    : [];

  return (
    <Card className="rounded-xl h-full">
      <CardHeader className="border-b border-borderSoft p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
          {headerAction}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(420px,520px)_minmax(0,1fr)] xl:items-start">
          <div className="flex justify-center overflow-hidden xl:justify-start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={onSelectDate}
              events={calendarEvents}
              modifiers={{ hasEvents: eventDates }}
              modifiersClassNames={{
                hasEvents: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary"
              }}
              className="rounded-2xl"
            />
          </div>

          <div className="min-w-0 border-t border-borderSoft pt-5 xl:min-h-[460px] xl:border-l xl:border-t-0 xl:pl-6 xl:pt-1">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              {selectedDate ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'Select a date'}
            </h4>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 xl:max-h-[410px]">
              {selectedDate ? (
                (() => {
                  const dayGrouped = groupBookings(selectedDateEvents, venues);
                  return dayGrouped.length > 0 ? (
                    dayGrouped.map((event, index) => (
                      <motion.div
                        key={event.batchId || event.ids?.[0] || index}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                      >
                        <Card className="border border-borderSoft rounded-xl hover:border-brand/30 transition-colors">
                          <CardContent className="p-4">
                            <div className="font-semibold text-foreground text-sm mb-1">{event.eventName}</div>
                            <div className="mt-0.5 mb-2 flex flex-wrap items-center gap-2">
                              <span className="text-xs text-primary font-medium">{event.clubName}</span>
                              {event.eventType && (
                                <Badge variant="outline" className="text-[10px] h-5">
                                  {formatEventType(event.eventType)}
                                </Badge>
                              )}
                            </div>
                            <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                              <Clock size={12} className="text-primary/60 mt-0.5" />
                              <span>{event.startTime} - {event.endTime}</span>
                            </div>
                            <div className="mt-1.5 flex items-start gap-2 text-xs text-muted-foreground">
                              <MapPin size={12} className="text-primary/60 mt-0.5" />
                              <span>{event.venueName}</span>
                            </div>
                            {event.status === 'partial' && (
                              <div className="mt-2">
                                <Badge variant="warning" className="text-[10px]">PARTIAL APPROVAL</Badge>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {emptyMessage}
                    </div>
                  );
                })()
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ClubDashboard: React.FC<ClubDashboardProps> = ({ user }) => {
  const [allEvents, setAllEvents] = React.useState<Booking[]>([]);
  const [myEvents, setMyEvents] = React.useState<Booking[]>([]);
  const [venues, setVenues] = React.useState<ApiVenue[]>([]);
  const [registeredEvents, setRegisteredEvents] = React.useState<AppEvent[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = React.useState(false);
  const [newEvent, setNewEvent] = React.useState({ name: '', date: '', venue: '' });
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [calendarView, setCalendarView] = React.useState<'global' | 'club'>('global');
  const navigate = useNavigate();

  const isCommittee = user.name.toLowerCase().includes('committee');
  const entityType = isCommittee ? 'Committee' : 'Club';

  const fetchEvents = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [venuesData, myBookings, publicBookings, eventsData] = await Promise.all([
        apiRequest<ApiVenue[]>('/api/venues'),
        apiRequest<ApiBooking[]>('/api/my-bookings', { auth: true }),
        apiRequest<ApiBooking[]>('/api/campus-bookings', { auth: true }),
        apiRequest<AppEvent[]>('/api/events', { auth: true }),
      ]);

      const mappedMyBookings = myBookings.map(mapBooking);
      const mappedPublicBookings = publicBookings.map(mapBooking);

      setVenues(venuesData);
      setMyEvents(mappedMyBookings);
      setAllEvents(mappedPublicBookings);
      setRegisteredEvents(eventsData);
    } catch (err) {
      console.error('Failed to fetch events:', err);
      setError(getErrorMessage(err, 'Failed to load events.'));
      setAllEvents([]);
      setMyEvents([]);
      setRegisteredEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCreateEvent = async () => {
    setIsSaving(true);
    try {
      await apiRequest('/api/events', {
        method: 'POST',
        auth: true,
        body: newEvent,
      });
      toast.success('Event registered successfully');
      setIsAddEventOpen(false);
      setNewEvent({ name: '', date: '', venue: '' });
      fetchEvents();
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error('Failed to register event');
    } finally {
      setIsSaving(false);
    }
  };

  React.useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Socket.io: join the club's own room and listen for booking status changes
  React.useEffect(() => {
    // We use the user's email to associate with the right club room
    // The server emits to `club:${data.club_id}`, so we need the club id
    // We'll figure it out once events load by checking myEvents[0]?.clubId
    const socket = getSocket();

    // Join club room if we have a clubId from the first event
    if (myEvents.length > 0) {
      socket.emit(SOCKET_EVENTS.JOIN_CLUB, myEvents[0].clubId);
    } else if (user?.role === 'club') {
      // If we have at least one event, it works. 
    }

    const handleStatusChanged = (payload: { eventName: string; status: 'approved' | 'rejected' | 'deleted'; clubId: string }) => {
      fetchEvents(); // refresh to show updated status
    };

    const handleEventsUpdated = () => {
      fetchEvents();
    };

    socket.on(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleStatusChanged);
    socket.on(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
    return () => {
      socket.off(SOCKET_EVENTS.BOOKING_STATUS_CHANGED, handleStatusChanged);
      socket.off(SOCKET_EVENTS.EVENTS_UPDATED, handleEventsUpdated);
    };
  }, [fetchEvents, myEvents, user]);

  const getVenueName = (id: string) => venues.find(v => v.id === id)?.name || id;

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const visibleGlobalEvents = React.useMemo(() => {
    const myEventIds = new Set(myEvents.map(event => event.id));
    const otherPublicEvents = allEvents.filter(event => !myEventIds.has(event.id));
    return [...myEvents, ...otherPublicEvents];
  }, [allEvents, myEvents]);

  const getEventDates = React.useCallback((events: Booking[]) =>
    events.map(e => {
      const d = new Date(e.date);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }),
    []
  );

  const toCalendarEvents = React.useCallback((events: Booking[]): CalendarEvent[] =>
    events.map(e => ({
      eventName: e.eventName,
      clubName: e.clubName,
      date: e.date,
      startTime: e.startTime,
      endTime: e.endTime,
      venueName: getVenueName(e.venueId),
      status: e.status,
      eventType: e.eventType,
    })),
    [venues]
  );

  // Normalize to local midnight so DayPicker's modifier date-matching works correctly
  const eventDates = React.useMemo(() => getEventDates(visibleGlobalEvents), [getEventDates, visibleGlobalEvents]);
  const myEventDates = React.useMemo(() => getEventDates(myEvents), [getEventDates, myEvents]);

  // Show approved campus bookings plus this club's own bookings, including closed-club events for booking awareness.
  const calendarEventsWithVenue = React.useMemo(() => toCalendarEvents(visibleGlobalEvents), [toCalendarEvents, visibleGlobalEvents]);
  const myCalendarEventsWithVenue = React.useMemo(() => toCalendarEvents(myEvents), [toCalendarEvents, myEvents]);
  const activeCalendar = React.useMemo(() => {
    if (calendarView === 'club') {
      return {
        title: 'My Club Calendar',
        sourceEvents: myEvents,
        calendarEvents: myCalendarEventsWithVenue,
        eventDates: myEventDates,
        emptyMessage: 'No club events scheduled for this day.',
      };
    }

    return {
      title: 'Global Event Schedule',
      sourceEvents: visibleGlobalEvents,
      calendarEvents: calendarEventsWithVenue,
      eventDates,
      emptyMessage: 'No events scheduled for this day.',
    };
  }, [
    calendarView,
    calendarEventsWithVenue,
    eventDates,
    myCalendarEventsWithVenue,
    myEventDates,
    myEvents,
    visibleGlobalEvents,
  ]);

  const upcomingEvents = React.useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return groupBookings(visibleGlobalEvents, venues)
      .filter(e => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);
  }, [visibleGlobalEvents, venues]);

  if (error) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight">Welcome, {user.name}</h2>
        </div>
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle size={16} />
          <AlertTitle>Could not load dashboard</AlertTitle>
          <AlertDescription className="mt-1">{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={fetchEvents}>
            <RefreshCw size={14} />
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-10 w-64 sm:w-80" />
            <Skeleton className="h-5 w-72 sm:w-96" />
          </div>
          <Skeleton className="h-11 w-full sm:w-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-[420px] w-full rounded-2xl" />
          </div>
          <Skeleton className="h-[320px] w-full rounded-2xl" />
        </div>
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 sm:space-y-8"
    >
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight truncate">Welcome, {user.name}</h2>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base font-medium">Manage your events and venue bookings efficiently.</p>
        </div>
        <Button
          asChild
          className="w-full sm:w-auto shrink-0 rounded-xl h-11 shadow-lg shadow-primary/20"
        >
          <Link to="/book">
            <CalendarPlus size={20} />
            <span>Book a New Slot</span>
          </Link>
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 sm:gap-8">
        {/* Schedule Calendar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ScheduleCalendarCard
            title={activeCalendar.title}
            headerAction={
              <Tabs
                value={calendarView}
                onValueChange={(value) => setCalendarView(value as 'global' | 'club')}
              >
                <TabsList aria-label="Calendar view" className="grid w-full grid-cols-2 sm:w-auto">
                  <TabsTrigger value="global">Global</TabsTrigger>
                  <TabsTrigger value="club">My Club</TabsTrigger>
                </TabsList>
              </Tabs>
            }
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            sourceEvents={activeCalendar.sourceEvents}
            calendarEvents={activeCalendar.calendarEvents}
            eventDates={activeCalendar.eventDates}
            venues={venues}
            emptyMessage={activeCalendar.emptyMessage}
          />
        </motion.div>

        {/* Your Upcoming Events & Registered Events (Sidebar) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-6"
        >
          {/* Card 1: My Club Bookings */}
          <Card className="border border-borderSoft rounded-xl">
            <CardHeader className="border-b border-borderSoft">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">My {entityType} Bookings</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/my-bookings" className="text-xs">View All</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
                {groupBookings(myEvents, venues).map((event, index) => (
                  <motion.div
                    key={event.batchId || event.ids?.[0] || index}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="p-4 hover:bg-hoverSoft transition-colors"
                  >
                    <div className="font-semibold text-foreground text-sm">{event.eventName}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <CalendarPlus size={12} />
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <MapPin size={12} />
                      {event.venueName}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      {event.eventType && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {formatEventType(event.eventType)}
                        </Badge>
                      )}
                      {event.expectedAttendees && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users size={10} />
                          <span>{event.expectedAttendees}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <Badge
                        variant={
                          event.status === 'approved' ? 'success' :
                            event.status === 'pending' ? 'pending' :
                              event.status === 'partial' ? 'warning' :
                                'destructive'
                        }
                        className="text-[10px]"
                      >
                        <span>{event.status === 'partial' ? 'Partially Approved' : event.status}</span>
                      </Badge>
                    </div>
                  </motion.div>
                ))}
                {myEvents.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">No upcoming bookings.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Registered Events */}
          <Card className="border border-borderSoft rounded-xl">
            <CardHeader className="border-b border-borderSoft">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Registered {entityType} Events</CardTitle>
                <Button 
                  onClick={() => setIsAddEventOpen(true)} 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-xs text-brand hover:text-brand/80 hover:bg-brand/10 gap-1 rounded-lg font-semibold"
                >
                  <Plus size={14} />
                  Register
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40 overflow-y-auto max-h-[300px]">
                {registeredEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-4 hover:bg-hoverSoft/40 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-foreground text-sm truncate">{event.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Date: {new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate('/book', { 
                          state: { 
                            prefill: { 
                              event_id: event.id,
                              eventName: event.name,
                              date: event.date ? event.date.split('T')[0] : '',
                              venueName: event.venue || ''
                            } 
                          } 
                        })}
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] rounded-lg bg-brand/10 hover:bg-brand/20 border-brand/20 text-brand font-bold shrink-0 px-2.5 py-0"
                      >
                        Book Slot
                      </Button>
                    </div>
                  </motion.div>
                ))}
                {registeredEvents.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No registered events yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Events */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Card className="border border-borderSoft rounded-xl">
          <CardHeader className="border-b border-borderSoft">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg sm:text-xl">Upcoming Events</CardTitle>
                <CardDescription className="mt-1">Events happening in the coming days across all venues</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {upcomingEvents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingEvents.map((event, index) => (
                  <motion.div
                    key={event.batchId || event.ids?.[0] || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card className="border border-borderSoft rounded-xl hover:border-brand/30 hover:shadow-md transition-all duration-200 h-full">
                      <CardContent className="p-4">
                        <div className="font-semibold text-foreground text-sm leading-tight mb-1">{event.eventName}</div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-primary font-medium">{event.clubName}</span>
                          {event.eventType && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {formatEventType(event.eventType)}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <CalendarPlus size={12} className="text-primary/60 shrink-0" />
                            <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock size={12} className="text-primary/60 shrink-0" />
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin size={12} className="text-primary/60 shrink-0" />
                            <span>{event.venueName}</span>
                          </div>
                          {event.status === 'partial' && (
                            <div className="mt-2">
                              <Badge variant="warning" className="text-[10px]">PARTIALLY APPROVED</Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No upcoming events scheduled.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Policy Reminder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <Alert variant="info" className="border-brand/30 bg-primary/5 rounded-2xl">
          <Info className="h-4 w-4 shrink-0" />
          <AlertTitle>Booking Policy Reminder</AlertTitle>
          <AlertDescription className="mt-1">
            Category A venues are auto-approved for Group A clubs if no conflict exists.
            Category B venues (Lecture Theatres) always require Admin approval.
          </AlertDescription>
        </Alert>
      </motion.div>

      {/* Dialog for Register Event */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-card border border-borderSoft text-textPrimary">
          <DialogHeader>
            <DialogTitle>Register a New Event</DialogTitle>
            <DialogDescription className="text-textMuted">
              Create an event to tie slot bookings to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="event-name-dialog" className="text-textSecondary">Event Name *</Label>
              <Input
                id="event-name-dialog"
                value={newEvent.name}
                onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                placeholder="e.g. Annual Tech Fest"
                className="rounded-xl bg-bgMain border-borderSoft text-textPrimary"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-date-dialog" className="text-textSecondary">Date *</Label>
              <Input
                id="event-date-dialog"
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                className="rounded-xl bg-bgMain border-borderSoft text-textPrimary"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddEventOpen(false)} className="rounded-xl border-borderSoft text-textSecondary hover:bg-hoverSoft">Cancel</Button>
            <Button 
              type="button"
              onClick={handleCreateEvent} 
              disabled={isSaving || !newEvent.name || !newEvent.date}
              className="rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              {isSaving ? 'Registering...' : 'Register Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ClubDashboard;
