import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '../lib/api';
import { toastInfo, toastError } from '../lib/toast';
import { getErrorMessage } from '../lib/errors';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Skeleton } from '../components/ui/skeleton';
import { Calendar, Clock, MapPin, Edit, Trash2, Plus, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import RegisterEventDialog from '../components/RegisterEventDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AppEvent, User } from '../types';
import { cn } from '../lib/utils';

interface ManageEventsProps {
  currentUser?: User;
}

const ManageEvents: React.FC<ManageEventsProps> = ({ currentUser }) => {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AppEvent | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; date: string; startTime: string; endDate: string; endTime: string; venue: string[]; event_type: string }>({ name: '', date: '', startTime: '', endDate: '', endTime: '', venue: [], event_type: 'open_all' });
  const [isSaving, setIsSaving] = useState(false);

  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'ongoing' | 'past'>('upcoming');

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [eventsData, venuesData] = await Promise.all([
        apiRequest<AppEvent[]>('/api/events', { auth: true }),
        apiRequest<{ id: string; name: string }[]>('/api/venues')
      ]);
      setEvents(eventsData);
      setVenues(venuesData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError(getErrorMessage(err, 'Failed to load events.'));
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categorizedEvents = React.useMemo(() => {
    const now = new Date();
    const result = { upcoming: [] as AppEvent[], ongoing: [] as AppEvent[], past: [] as AppEvent[] };
    events.forEach(event => {
      const startDate = new Date(event.date);
      const endDate = event.dynamic_end_date ? new Date(event.dynamic_end_date) : startDate;
      if (endDate < now) {
        result.past.push(event);
      } else if (startDate <= now && endDate >= now) {
        result.ongoing.push(event);
      } else {
        result.upcoming.push(event);
      }
    });
    return result;
  }, [events]);

  const displayedEvents = categorizedEvents[activeTab];

  const handleEditClick = (event: AppEvent) => {
    setEditingEvent(event);
    
    // Parse the stored dates
    const startDate = new Date(event.date);
    const endDate = event.dynamic_end_date ? new Date(event.dynamic_end_date) : startDate;

    setEditForm({
      name: event.name,
      date: isNaN(startDate.getTime()) ? '' : startDate.toISOString().split('T')[0],
      startTime: isNaN(startDate.getTime()) ? '' : startDate.toTimeString().substring(0, 5),
      endDate: isNaN(endDate.getTime()) ? '' : endDate.toISOString().split('T')[0],
      endTime: isNaN(endDate.getTime()) ? '' : endDate.toTimeString().substring(0, 5),
      venue: event.venue ? event.venue.split(', ') : [],
      event_type: (event as any).event_type || 'open_all'
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingEvent) return;
    setIsSaving(true);
    try {
      // Combine date and time
      const startDateTime = new Date(`${editForm.date}T${editForm.startTime || '00:00'}:00`);
      const endDateTime = new Date(`${editForm.endDate || editForm.date}T${editForm.endTime || '23:59'}:00`);

      await apiRequest(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        auth: true,
        body: {
          name: editForm.name,
          date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          venue: editForm.venue.join(', '),
          event_type: editForm.event_type
        }
      });
      toastInfo('Event updated successfully');
      setIsEditOpen(false);
      fetchData();
    } catch (err) {
      toastError(err, 'Failed to update event');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to completely delete this event? This action will archive and remove all associated bookings and reports. It cannot be undone.')) {
      return;
    }
    try {
      await apiRequest(`/api/events/${eventId}`, { method: 'DELETE', auth: true });
      toastInfo('Event deleted successfully');
      fetchData();
    } catch (err) {
      toastError(err, 'Failed to delete event');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 px-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <motion.h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-textPrimary tracking-tighter">Manage Events</motion.h2>
          <p className="text-textSecondary mt-2 sm:mt-3 text-sm sm:text-base font-medium leading-relaxed max-w-xl">
            View, edit, or delete your registered events.
          </p>
        </div>
        <Button onClick={() => setIsAddEventOpen(true)} className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90 gap-2 shrink-0">
          <Plus size={18} /> Register Event
        </Button>
      </div>

      {error && (
        <Alert className="rounded-2xl border-2 border-error/30 bg-error/5">
          <AlertTriangle size={18} className="text-error" />
          <AlertTitle className="font-bold text-error">Could not load events</AlertTitle>
          <AlertDescription className="mt-2 text-error/80">{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-4 gap-2 border-error/30 hover:bg-error/5" onClick={fetchData}>
            <RefreshCw size={16} /> Retry
          </Button>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border border-borderSoft rounded-lg p-6 bg-card">
              <Skeleton className="h-24 w-full rounded-md" />
            </Card>
          ))}
        </div>
      ) : !error && events.length === 0 ? (
        <Card className="border-2 border-dashed border-borderSoft rounded-lg p-16 text-center bg-card shadow-none">
          <Calendar className="h-16 w-16 mx-auto text-textMuted/40 mb-4" />
          <p className="text-textMuted text-lg font-semibold">No registered events found.</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="flex bg-card p-1 rounded-xl border border-borderSoft w-fit">
            {['upcoming', 'ongoing', 'past'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={cn(
                  "px-6 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all",
                  activeTab === tab ? "bg-brand text-white shadow-sm" : "text-textMuted hover:text-textPrimary"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {displayedEvents.length === 0 ? (
            <Card className="border border-borderSoft rounded-lg p-12 text-center bg-card shadow-sm">
              <p className="text-textMuted text-base font-medium">No {activeTab} events found.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {displayedEvents.map((event, index) => {
                const startDate = new Date(event.date);
            const endDate = event.dynamic_end_date ? new Date(event.dynamic_end_date) : startDate;
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="border border-borderSoft rounded-lg hover:border-brand/50 transition-colors shadow-sm bg-card">
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-textPrimary mb-1">{event.name}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-textMuted">
                        <div className="flex items-center gap-1.5">
                          <Clock size={14} className="text-brand/70" />
                          <span>
                            {startDate.toLocaleDateString()} {startDate.toTimeString().substring(0, 5)} - {endDate.toLocaleDateString()} {endDate.toTimeString().substring(0, 5)}
                          </span>
                        </div>
                        {event.venue && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-brand/70" />
                            <span>{event.venue}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(event)} className="gap-2">
                        <Edit size={14} /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(event.id)} className="gap-2 text-error border-error/30 hover:bg-error/10 hover:border-error">
                        <Trash2 size={14} /> Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
        )}
      </div>
      )}

      {/* Edit Event Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl bg-card border border-borderSoft text-textPrimary overflow-y-auto max-h-[85dvh]">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Modify event details and dates.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Event Name</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Event Type *</Label>
              <Select value={editForm.event_type} onValueChange={val => setEditForm({ ...editForm, event_type: val })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_all">Open for All</SelectItem>
                  <SelectItem value="co_curricular">Co-Curricular Activity</SelectItem>
                  <SelectItem value="closed_club">Closed Club Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                  min={todayStr}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editForm.startTime}
                  onChange={e => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={editForm.endDate}
                  onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
                  min={editForm.date || todayStr}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editForm.endTime}
                  onChange={e => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-textSecondary">Venues * (Select one or more)</Label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-borderSoft rounded-xl bg-bgMain">
                {[{ id: 'online', name: 'Online' }, ...venues].map(v => {
                  const isSelected = editForm.venue.includes(v.name);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        if (v.name === 'Online') {
                          setEditForm({ ...editForm, venue: ['Online'] });
                        } else {
                          if (isSelected) {
                            const newVenues = editForm.venue.filter(n => n !== v.name);
                            setEditForm({ ...editForm, venue: newVenues.length === 0 ? ['Online'] : newVenues });
                          } else {
                            setEditForm({ ...editForm, venue: [...editForm.venue.filter(n => n !== 'Online'), v.name] });
                          }
                        }
                      }}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        isSelected ? 'bg-brand text-white border-brand' : 'bg-transparent text-textSecondary border-borderSoft hover:border-brand/50'
                      }`}
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isSaving || !editForm.name || !editForm.date || editForm.venue.length === 0} className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RegisterEventDialog 
        isOpen={isAddEventOpen} 
        onOpenChange={setIsAddEventOpen} 
        currentUser={currentUser}
        onEventCreated={() => fetchData()}
      />
    </motion.div>
  );
};

export default ManageEvents;
