// src/components/EventsDisplay.js

import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Ticket, 
  Search, 
  Filter,
  MapPin,
  Clock,
  TrendingUp,
  Plus,
  X,
  ChevronDown,
  Loader
} from 'lucide-react';

const EventsDisplay = ({ 
  events, 
  loading, 
  onBuyTicket, 
  onVoteForEvent,
  myTickets,
  account 
}) => {
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    activeOnly: true,
    futureOnly: true,
    maxPrice: '',
    sortBy: 'date'
  });
  const [expandedEvent, setExpandedEvent] = useState(null);

  // Filtrer les événements
  const filteredEvents = events.filter(event => {
    if (filters.activeOnly && !event.isActive) return false;
    if (filters.futureOnly && event.date < new Date()) return false;
    
    if (searchText) {
      const search = searchText.toLowerCase();
      if (!event.name.toLowerCase().includes(search)) return false;
    }
    
    if (filters.maxPrice) {
      const hasAffordableTicket = event.tickets.some(
        ticket => parseFloat(ticket.price) <= parseFloat(filters.maxPrice)
      );
      if (!hasAffordableTicket) return false;
    }
    
    return true;
  });

  // Trier les événements
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (filters.sortBy) {
      case 'date':
        return a.date - b.date;
      case 'price':
        const minPriceA = Math.min(...a.tickets.map(t => parseFloat(t.price)));
        const minPriceB = Math.min(...b.tickets.map(t => parseFloat(t.price)));
        return minPriceA - minPriceB;
      case 'popularity':
        return b.voteCount - a.voteCount;
      default:
        return 0;
    }
  });

  // Formater la date
  const formatDate = (date) => {
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('fr-FR', options);
  };

  // Calculer le temps restant
  const getTimeRemaining = (date) => {
    const now = new Date();
    const diff = date - now;
    
    if (diff < 0) return 'Événement passé';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 30) return `Dans ${Math.floor(days / 30)} mois`;
    if (days > 0) return `Dans ${days} jour${days > 1 ? 's' : ''}`;
    if (hours > 0) return `Dans ${hours} heure${hours > 1 ? 's' : ''}`;
    return 'Bientôt';
  };

  // Vérifier si l'utilisateur participe
  const isParticipating = (eventId) => {
    return myTickets.some(ticket => ticket.eventId === eventId);
  };

  // Calculer le pourcentage de vente
  const getSoldPercentage = (current, max) => {
    return Math.round((current / max) * 100);
  };

  // Obtenir le prix minimum
  const getMinPrice = (tickets) => {
    if (tickets.length === 0) return '0';
    return Math.min(...tickets.map(t => parseFloat(t.price))).toFixed(3);
  };

  return (
    <div className="space-y-6">
      {/* Barre de recherche */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un événement..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Liste des événements */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Aucun événement trouvé</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
                <h3 className="text-xl font-bold mb-2">{event.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(event.date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {getTimeRemaining(event.date)}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-sm opacity-75">À partir de</p>
                  <p className="text-2xl font-bold">{getMinPrice(event.tickets)} ETH</p>
                </div>
              </div>
              
              <div className="p-6">
                {event.tickets.map((ticket) => (
                  <div key={ticket.id} className="border rounded-lg p-4 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold">{ticket.name}</h4>
                        {ticket.hasOptions && (
                          <p className="text-sm text-gray-600 mt-1">
                            <Plus className="h-3 w-3 inline mr-1" />
                            {ticket.options}
                          </p>
                        )}
                      </div>
                      <p className="text-xl font-bold text-purple-600">{ticket.price} ETH</p>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>{ticket.currentSupply}/{ticket.maxSupply} vendus</span>
                        <span>{getSoldPercentage(ticket.currentSupply, ticket.maxSupply)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                          style={{ width: `${getSoldPercentage(ticket.currentSupply, ticket.maxSupply)}%` }}
                        />
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onBuyTicket(ticket.id, ticket.price)}
                      disabled={ticket.currentSupply >= ticket.maxSupply}
                      className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {ticket.currentSupply >= ticket.maxSupply ? 'Épuisé' : 'Acheter'}
                    </button>
                  </div>
                ))}
                
                {isParticipating(event.id) && (
                  <button
                    onClick={() => onVoteForEvent(event.id)}
                    className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm"
                  >
                    Voter pour cet événement
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ⚠️ TRÈS IMPORTANT : Cette ligne DOIT être à la fin du fichier !
export default EventsDisplay;