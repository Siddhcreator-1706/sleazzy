import React, { useState, useEffect } from 'react';
import { User, AppEvent } from '../types';
import { apiRequest } from '../lib/api';
import { toastError, toastSuccess } from '../lib/toast';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Calendar as CalendarIcon, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';



interface ClubCommitteeProps {
  user: User;
}

const ClubCommittee: React.FC<ClubCommitteeProps> = ({ user }) => {
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', venue: '' });
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const isCommittee = user.name.toLowerCase().includes('committee');
  const entityType = isCommittee ? 'Committee' : 'Club';

  const fetchData = async () => {
    try {
      const eventsData = await apiRequest<AppEvent[]>('/api/events', { auth: true });
      setEvents(eventsData);
    } catch (error) {
      toastError(error, 'Failed to fetch data');
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateEvent = async () => {
    setIsSaving(true);
    try {
      await apiRequest('/api/events', {
        method: 'POST',
        auth: true,
        body: newEvent,
      });
      toastSuccess('Event created successfully');
      setIsAddEventOpen(false);
      setNewEvent({ name: '', date: '', venue: '' });
      fetchData();
    } catch (error) {
      toastError(error, 'Failed to create event');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-textPrimary tracking-tight flex items-center gap-2">
            <CalendarIcon className="text-brand" size={28} />
            {entityType} Events
          </h1>
          <p className="text-textMuted mt-1 text-sm sm:text-base">
            Register and manage your {entityType.toLowerCase()}'s list of events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/members')} variant="outline" className="rounded-xl">
            Edit {entityType} Members
          </Button>
          <Button onClick={() => setIsAddEventOpen(true)} className="rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold">
            <Plus size={16} className="mr-1.5" />
            Register Event
          </Button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-borderSoft shadow-sm flex flex-col min-h-[400px]">
        <h3 className="text-lg font-bold text-textPrimary mb-4">Registered Events</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-sm text-textMuted">No registered events yet.</p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="p-5 rounded-xl border border-borderSoft bg-hoverSoft/20 hover:bg-hoverSoft/40 transition-all flex flex-col justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-base text-textPrimary">{event.name}</h4>
                  <p className="text-xs text-textMuted mt-1">
                    Date: {new Date(event.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  {event.venue && (
                    <p className="text-xs text-textMuted mt-0.5">
                      Target Venue: {event.venue}
                    </p>
                  )}
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
                  className="w-full text-xs rounded-lg font-semibold bg-brand/10 hover:bg-brand/20 text-brand gap-1"
                >
                  <Plus size={14} />
                  Book Slot
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Register a New Event</DialogTitle>
            <DialogDescription>
              Create an event to tie slot bookings to it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Event Name</Label>
              <Input
                value={newEvent.name}
                onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                placeholder="e.g. Annual Tech Fest"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEventOpen(false)} className="rounded-xl">Cancel</Button>
            <Button 
              onClick={handleCreateEvent} 
              disabled={isSaving || !newEvent.name || !newEvent.date}
              className="rounded-xl bg-brand hover:bg-brand/90 text-white font-semibold"
            >
              {isSaving ? 'Creating...' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClubCommittee;
