// src/App.js
import React, { useState, useEffect } from 'react';
import EventsDisplay from './components/EventsDisplay';

import { ethers } from 'ethers';
import { 
  Calendar, 
  Ticket, 
  Users, 
  Coins, 
  CheckCircle, 
  AlertCircle, 
  Wallet,
  LogOut,
  Plus,
  QrCode,
  TrendingUp,
  Clock,
  MapPin
} from 'lucide-react';

// Configuration - À remplacer par vos valeurs
const BLOCKEVENT_ADDRESS = process.env.REACT_APP_BLOCKEVENT_ADDRESS || "0x8a9bD417F6a7fc83DBFe5268bF53AEA04682683c";
const BLOCKTOKEN_ADDRESS = process.env.REACT_APP_BLOCKTOKEN_ADDRESS || "0xd40e17fd7c1cc99e34189f313572d691F208b06c";

// ABI minimal des contrats
const BLOCKEVENT_ABI = [
  "function createEvent(string name, uint256 date, uint256 maxResalePercentage)",
  "function createTicketType(uint256 eventId, string name, uint256 price, uint256 maxSupply, bool hasOptions, string optionDescription, uint256 royaltyPercentage)",
  "function buyTickets(uint256 ticketTypeId, uint256 amount) payable",
  "function validateTicket(uint256 ticketTypeId, address ticketHolder)",
  "function voteForEvent(uint256 eventId)",
  "function withdrawFunds(uint256 eventId)",
  "function getEventInfo(uint256 eventId) view returns (string, address, uint256, bool, bool, uint256, uint256, uint256[])",
  "function ticketTypes(uint256) view returns (uint256, string, uint256, uint256, uint256, bool, string, uint256, uint256)",
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function hasUsedTicket(uint256, address) view returns (bool)",
  "function governanceToken() view returns (address)",
  "event EventCreated(uint256 eventId, string name, address organizer)",
  "event TicketTypeCreated(uint256 ticketTypeId, uint256 eventId, string name)",
  "event TicketPurchased(address buyer, uint256 ticketTypeId, uint256 amount)"
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

function App() {
  // État principal
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [blockEventContract, setBlockEventContract] = useState(null);
  const [blockTokenContract, setBlockTokenContract] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('events');

  // État des données
  const [events, setEvents] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [tokenBalance, setTokenBalance] = useState('0');

  // État des formulaires
  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    maxResale: '150'
  });

  const [newTicketType, setNewTicketType] = useState({
    eventId: '',
    name: '',
    price: '',
    maxSupply: '',
    hasOptions: false,
    options: '',
    royalty: '5'
  });

  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateTicket, setShowCreateTicket] = useState(false);

  // Connexion au wallet
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        showMessage('error', 'Veuillez installer MetaMask!');
        return;
      }

      setLoading(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      // Contrat principal
      const blockEventContract = new ethers.Contract(BLOCKEVENT_ADDRESS, BLOCKEVENT_ABI, signer);
      
      // Contrat token
      const tokenAddress = await blockEventContract.governanceToken();
      const blockTokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      setAccount(accounts[0]);
      setProvider(provider);
      setBlockEventContract(blockEventContract);
      setBlockTokenContract(blockTokenContract);
      
      showMessage('success', 'Wallet connecté!');
      
      // Charger les données
      //await loadAllData(blockEventContract, blockTokenContract, accounts[0]);
      await loadEvents(blockEventContract);
      await loadMyTickets(blockEventContract, accounts[0]);
      await loadMyEvents(blockEventContract, accounts[0]);
      await loadTokenBalance(blockTokenContract, accounts[0]);
      
      // Écouter les événements
      setupEventListeners(blockEventContract);
    } catch (error) {
      showMessage('error', 'Erreur de connexion: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion
  const disconnectWallet = () => {
    setAccount('');
    setProvider(null);
    setBlockEventContract(null);
    setBlockTokenContract(null);
    setEvents([]);
    setMyTickets([]);
    setMyEvents([]);
    setTokenBalance('0');
    showMessage('info', 'Wallet déconnecté');
  };

  // Charger toutes les données
  const loadAllData = async (contract, tokenContract, userAccount) => {
    try {
      // Charger les événements (simulé pour la démo)
      await loadEvents(contract);
      
      // Charger mes billets
      await loadMyTickets(contract, userAccount);
      
      // Charger mes événements créés
      await loadMyEvents(contract, userAccount);
      
      // Charger balance tokens
      await loadTokenBalance(tokenContract, userAccount);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

const loadEvents = async (contract) => {
  if (!contract) {
    console.log("❌ loadEvents: Pas de contrat!");
    return;
  }
  
  try {
    setLoading(true);
    console.log("🔍 Chargement des événements depuis la blockchain...");
    console.log("📍 Contract address:", contract.address);
    
    // Méthode 1 : Utiliser les logs EventCreated
    try {
      const eventFilter = contract.filters.EventCreated();
      const eventLogs = await contract.queryFilter(eventFilter, 0, 'latest');
      console.log(` ${eventLogs.length} événements créés trouvés dans les logs`);
      
      if (eventLogs.length > 0) {
        const eventsData = [];
        
        for (const log of eventLogs) {
          const eventId = log.args.eventId.toNumber();
          console.log(`\n Chargement événement ${eventId}...`);
          
          try {
            // Récupérer les infos de l'événement
            const eventInfo = await contract.getEventInfo(eventId);
            
            const event = {
              id: eventId,
              name: eventInfo[0],
              organizer: eventInfo[1],
              date: new Date(eventInfo[2].toNumber() * 1000),
              isActive: eventInfo[3],
              isCancelled: eventInfo[4],
              totalRevenue: ethers.utils.formatEther(eventInfo[5]),
              voteCount: eventInfo[6].toNumber(),
              tickets: [] // On va remplir ça
            };
            
            console.log(` Event: ${event.name}`);
            
            // IMPORTANT : Charger les billets
            const ticketTypeIds = eventInfo[7]; // Array des IDs de billets
            console.log(` ${ticketTypeIds.length} types de billets à charger`);
            
            for (let j = 0; j < ticketTypeIds.length; j++) {
              const ticketId = ticketTypeIds[j].toNumber();
              try {
                const ticketType = await contract.ticketTypes(ticketId);
                
                const ticket = {
                  id: ticketId,
                  name: ticketType[1],
                  price: ethers.utils.formatEther(ticketType[2]),
                  maxSupply: ticketType[3].toNumber(),
                  currentSupply: ticketType[4].toNumber(),
                  hasOptions: ticketType[5],
                  options: ticketType[6],
                  royalty: ticketType[8]?.toNumber() || 0
                };
                
                event.tickets.push(ticket);
                console.log(`   Billet ${ticketId}: ${ticket.name} - ${ticket.price} ETH (${ticket.currentSupply}/${ticket.maxSupply})`);
                
              } catch (ticketError) {
                console.error(`   Erreur chargement billet ${ticketId}:`, ticketError.message);
              }
            }
            
            // Ajouter seulement si pas annulé
            if (!event.isCancelled) {
              eventsData.push(event);
              console.log(` Event ${eventId} ajouté avec ${event.tickets.length} billets`);
            } else {
              console.log(` Event ${eventId} annulé, non ajouté`);
            }
            
          } catch (eventError) {
            console.error(` Erreur chargement event ${eventId}:`, eventError.message);
          }
        }
        
        // Trier par date (plus récents en premier)
        eventsData.sort((a, b) => b.date - a.date);
        
        console.log(`\n TOTAL: ${eventsData.length} événements chargés avec leurs billets`);
        setEvents(eventsData);
        return;
      }
    } catch (logError) {
      console.log(" Erreur avec les logs, utilisation de la méthode fallback:", logError.message);
    }
    
    // Méthode 2 : Fallback - Scanner les IDs
    console.log("\n Méthode fallback : scan des IDs 1 à 20...");
    const eventsData = [];
    
    for (let i = 1; i <= 20; i++) {
      try {
        const eventInfo = await contract.getEventInfo(i);
        
        const event = {
          id: i,
          name: eventInfo[0],
          organizer: eventInfo[1],
          date: new Date(eventInfo[2].toNumber() * 1000),
          isActive: eventInfo[3],
          isCancelled: eventInfo[4],
          totalRevenue: ethers.utils.formatEther(eventInfo[5]),
          voteCount: eventInfo[6].toNumber(),
          tickets: []
        };
        
        // Charger les billets même en fallback
        const ticketTypeIds = eventInfo[7];
        for (const ticketId of ticketTypeIds) {
          try {
            const ticketType = await contract.ticketTypes(ticketId.toNumber());
            event.tickets.push({
              id: ticketId.toNumber(),
              name: ticketType[1],
              price: ethers.utils.formatEther(ticketType[2]),
              maxSupply: ticketType[3].toNumber(),
              currentSupply: ticketType[4].toNumber(),
              hasOptions: ticketType[5],
              options: ticketType[6],
              royalty: ticketType[8]?.toNumber() || 0
            });
          } catch (e) {
            console.log(`Erreur ticket ${ticketId}:`, e.message);
          }
        }
        
        if (!event.isCancelled && event.name) {
          eventsData.push(event);
          console.log(` Event ${i}: ${event.name} avec ${event.tickets.length} billets`);
        }
      } catch (e) {
        if (i === 1) {
          console.log(" Aucun événement trouvé!");
        }
        break;
      }
    }
    
    eventsData.sort((a, b) => b.date - a.date);
    console.log(`\n TOTAL FINAL: ${eventsData.length} événements chargés`);
    setEvents(eventsData);
    
  } catch (error) {
    console.error(" Erreur loadEvents:", error);
    setEvents([]);
    showMessage('error', 'Erreur lors du chargement des événements');
  } finally {
    setLoading(false);
  }
};
  
  // Charger mes billets
  const loadMyTickets = async (contract, userAccount) => {
    try {
      const tickets = [];
      
      // Vérifier le solde pour chaque type de billet
      for (const event of events) {
        for (const ticket of event.tickets) {
          const balance = await contract.balanceOf(userAccount, ticket.id);
          if (balance.gt(0)) {
            const hasUsed = await contract.hasUsedTicket(ticket.id, userAccount);
            tickets.push({
              ...ticket,
              eventName: event.name,
              eventDate: event.date,
              eventId: event.id,
              quantity: balance.toNumber(),
              used: hasUsed
            });
          }
        }
      }
      
      setMyTickets(tickets);
    } catch (error) {
      console.error('Erreur chargement billets:', error);
    }
  };

  // Charger mes événements créés
  const loadMyEvents = async (contract, userAccount) => {
    try {
      // Filtrer les événements où je suis organisateur
      const myEvts = events.filter(e => 
        e.organizer.toLowerCase() === userAccount.toLowerCase()
      );
      setMyEvents(myEvts);
    } catch (error) {
      console.error('Erreur chargement mes events:', error);
    }
  };

  // Charger balance tokens
  const loadTokenBalance = async (tokenContract, userAccount) => {
    try {
      const balance = await tokenContract.balanceOf(userAccount);
      setTokenBalance(ethers.utils.formatEther(balance));
    } catch (error) {
      console.error('Erreur balance tokens:', error);
      setTokenBalance('0');
    }
  };

  // Créer un événement
  const createEvent = async () => {
    try {
      setLoading(true);
      const dateTimestamp = Math.floor(new Date(newEvent.date).getTime() / 1000);
      
      const tx = await blockEventContract.createEvent(
        newEvent.name,
        dateTimestamp,
        parseInt(newEvent.maxResale)
      );
      
      showMessage('info', 'Transaction en cours...');
      const receipt = await tx.wait();
      
      // Extraire l'ID de l'événement créé
      const eventCreatedEvent = receipt.events?.find(e => e.event === 'EventCreated');
      const eventId = eventCreatedEvent?.args?.eventId?.toNumber();
      
      showMessage('success', `Événement créé avec succès! ID: ${eventId}`);
      setNewEvent({ name: '', date: '', maxResale: '150' });
      
      // Recharger les données
      await loadAllData(blockEventContract, blockTokenContract, account);
    } catch (error) {
      showMessage('error', 'Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Créer un type de billet
  const createTicketType = async () => {
    try {
      setLoading(true);
      
      const tx = await blockEventContract.createTicketType(
        parseInt(newTicketType.eventId),
        newTicketType.name,
        ethers.utils.parseEther(newTicketType.price),
        parseInt(newTicketType.maxSupply),
        newTicketType.hasOptions,
        newTicketType.options || '',
        parseInt(newTicketType.royalty)
      );
      
      showMessage('info', 'Création du type de billet...');
      await tx.wait();
      
      showMessage('success', 'Type de billet créé!');
      setNewTicketType({
        eventId: '',
        name: '',
        price: '',
        maxSupply: '',
        hasOptions: false,
        options: '',
        royalty: '5'
      });
      setShowCreateTicket(false);
      
      await loadEvents(blockEventContract);
    } catch (error) {
      showMessage('error', 'Erreur: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Acheter un billet
  const buyTicket = async (ticketId, price) => {
    try {
      setLoading(true);
      const value = ethers.utils.parseEther(price);
      
      const tx = await blockEventContract.buyTickets(ticketId, 1, { value });
      showMessage('info', 'Achat en cours...');
      await tx.wait();
      
      showMessage('success', 'Billet acheté! 🎉');
      await loadAllData(blockEventContract, blockTokenContract, account);
    } catch (error) {
      showMessage('error', 'Erreur achat: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Voter pour un événement
  const voteForEvent = async (eventId) => {
    try {
      setLoading(true);
      const tx = await blockEventContract.voteForEvent(eventId);
      showMessage('info', 'Vote en cours...');
      await tx.wait();
      
      showMessage('success', 'Vote enregistré! Vous avez gagné 5% de réduction sur votre prochain achat.');
      await loadEvents(blockEventContract);
    } catch (error) {
      showMessage('error', 'Erreur vote: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Valider un billet
  const validateTicket = async (ticketId, holderAddress) => {
    try {
      setLoading(true);
      const tx = await blockEventContract.validateTicket(ticketId, holderAddress);
      showMessage('info', 'Validation en cours...');
      await tx.wait();
      
      showMessage('success', 'Billet validé!');
      await loadMyTickets(blockEventContract, account);
    } catch (error) {
      showMessage('error', 'Erreur validation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = (contract) => {
  // Nettoyer les anciens listeners
  contract.removeAllListeners();
  
  // Écouter la création d'événements
  contract.on('EventCreated', async (eventId, name, organizer) => {
    console.log('Nouvel événement créé:', name);
    
    // Recharger la liste des événements
    await loadEvents(contract);
    showMessage('info', `Nouvel événement disponible: ${name}`);
  });
  
  // Écouter les achats de billets
  contract.on('TicketPurchased', async (buyer, ticketTypeId, amount) => {
    console.log('Billet acheté');
    
    // Si c'est nous qui avons acheté
    if (buyer.toLowerCase() === account.toLowerCase()) {
      await loadMyTickets(contract, account);
      await loadTokenBalance(blockTokenContract, account);
    }
    
    // Recharger les événements pour mettre à jour les stocks
    await loadEvents(contract);
  });
};

  // Afficher un message
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Formater l'adresse
  const formatAddress = (addr) => {
    return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
  };

  // Formater la date
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculer le % vendu
  const getSoldPercentage = (current, max) => {
    return Math.round((current / max) * 100);
  };

  // useEffect pour les changements de compte
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (accounts[0] !== account) {
          window.location.reload();
        }
      });
      
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, [account]);

  useEffect(() => {
  // Quand le composant se démonte, nettoyer les listeners
  return () => {
    if (blockEventContract) {
      blockEventContract.removeAllListeners();
    }
  };
}, [blockEventContract]);

const DebugPanel = () => (
  <div className="fixed bottom-0 left-0 right-0 bg-black text-white p-4 z-50">
    <h3 className="text-yellow-400 font-bold mb-2">🐛 DEBUG PANEL</h3>
    <div className="grid grid-cols-4 gap-4 text-sm">
      <div>
        <span className="text-gray-400">Account:</span><br/>
        {account ? `${account.slice(0, 6)}...` : 'Non connecté'}
      </div>
      <div>
        <span className="text-gray-400">Contract:</span><br/>
        {blockEventContract ? '✅ OK' : '❌ Manquant'}
      </div>
      <div>
        <span className="text-gray-400">Events:</span><br/>
        {Array.isArray(events) ? `${events.length} chargés` : '❌ Pas un array'}
      </div>
      <div>
        <span className="text-gray-400">Loading:</span><br/>
        {loading ? '⏳ Oui' : '✅ Non'}
      </div>
    </div>
    
    <div className="mt-3 flex gap-2">
      <button
        onClick={async () => {
          console.log("=== DEBUG INFO ===");
          console.log("1. Contract:", blockEventContract?.address);
          console.log("2. Events:", events);
          console.log("3. Loading:", loading);
          
          if (blockEventContract) {
            console.log("4. Test getEventInfo(1)...");
            try {
              const info = await blockEventContract.getEventInfo(1);
              console.log("✅ Event 1:", info[0]);
            } catch (e) {
              console.log("❌ Pas d'event 1");
            }
          }
        }}
        className="bg-blue-500 px-3 py-1 rounded text-xs"
      >
        📋 Log Info
      </button>
      
      <button
        onClick={async () => {
          if (!blockEventContract) {
            alert("Connectez-vous d'abord!");
            return;
          }
          console.log("Chargement manuel...");
          await loadEvents(blockEventContract);
        }}
        className="bg-green-500 px-3 py-1 rounded text-xs"
      >
        🔄 Recharger Events
      </button>
      
      <button
        onClick={async () => {
          if (!blockEventContract) {
            alert("Connectez-vous d'abord!");
            return;
          }
          try {
            console.log("Création event test...");
            const tx = await blockEventContract.createEvent(
              "Debug " + Date.now(),
              Math.floor(Date.now() / 1000) + 86400,
              150
            );
            console.log("TX:", tx.hash);
            await tx.wait();
            console.log("✅ Créé! Rechargement...");
            await loadEvents(blockEventContract);
          } catch (e) {
            console.error("Erreur:", e);
          }
        }}
        className="bg-purple-500 px-3 py-1 rounded text-xs"
      >
        ➕ Créer Event Test
      </button>
    </div>
    
    {events.length > 0 && (
      <div className="mt-3 text-xs">
        <span className="text-gray-400">Events chargés:</span>
        {events.map(e => (
          <span key={e.id} className="ml-2 text-green-400">
            [{e.id}] {e.name}
          </span>
        ))}
      </div>
    )}
  </div>
);
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Ticket className="h-8 w-8 text-purple-600" />
              <h1 className="text-2xl font-bold text-gray-800">BlockEvent</h1>
            </div>
            
            {account ? (
              <div className="flex items-center space-x-4">
                <div className="hidden sm:flex items-center space-x-2 text-sm">
                  <Coins className="h-4 w-4 text-yellow-600" />
                  <span className="font-semibold">{parseFloat(tokenBalance).toFixed(2)} BLOCK</span>
                </div>
                <span className="text-sm text-gray-600 hidden sm:inline">
                  {formatAddress(account)}
                </span>
                <button
                  onClick={disconnectWallet}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  title="Déconnecter"
                >
                  <LogOut className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition flex items-center space-x-2"
                disabled={loading}
              >
                <Wallet className="h-5 w-5" />
                <span>Connecter</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Message */}
      {message.text && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className={`p-4 rounded-lg flex items-center space-x-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-800' :
            message.type === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> :
             message.type === 'error' ? <AlertCircle className="h-5 w-5" /> :
             <AlertCircle className="h-5 w-5" />}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {account ? (
          <>
            {/* Tabs */}
            <div className="flex space-x-1 mb-8 bg-gray-100 p-1 rounded-lg max-w-fit">
              <button
                onClick={() => setActiveTab('events')}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  activeTab === 'events' 
                    ? 'bg-white text-purple-600 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Événements
              </button>
              <button
                onClick={() => setActiveTab('tickets')}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  activeTab === 'tickets' 
                    ? 'bg-white text-purple-600 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Mes Billets
              </button>
              <button
                onClick={() => setActiveTab('organize')}
                className={`px-6 py-2 rounded-lg font-medium transition ${
                  activeTab === 'organize' 
                    ? 'bg-white text-purple-600 shadow' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Organiser
              </button>
            </div>

            {activeTab === 'events' && (
              <EventsDisplay 
                events={events}
                loading={loading}
                onBuyTicket={buyTicket}
                onVoteForEvent={voteForEvent}
                myTickets={myTickets}
                account={account}
              />
            )}

            {/* Tab: Mes Billets */}
            {activeTab === 'tickets' && (
              <div className="grid gap-6">
                <h2 className="text-2xl font-bold">Mes Billets</h2>
                
                {myTickets.length === 0 ? (
                  <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                    <Ticket className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Vous n'avez pas encore de billets</p>
                    <button
                      onClick={() => setActiveTab('events')}
                      className="mt-4 text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Découvrir les événements →
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {myTickets.map((ticket, idx) => (
                      <div key={idx} className="bg-white rounded-xl shadow-lg p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-lg">{ticket.eventName}</h3>
                            <p className="text-gray-600">{ticket.name}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            ticket.used 
                              ? 'bg-gray-100 text-gray-600' 
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {ticket.used ? 'Utilisé' : 'Valide'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-2" />
                            {formatDate(ticket.eventDate)}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Ticket className="h-4 w-4 mr-2" />
                            Quantité: {ticket.quantity}
                          </div>
                          {ticket.hasOptions && (
                            <div className="flex items-center text-gray-600">
                              <Plus className="h-4 w-4 mr-2" />
                              {ticket.options}
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t">
                          <div className="bg-gray-100 rounded-lg p-4 text-center">
                            <QrCode className="h-20 w-20 mx-auto text-gray-400" />
                            <p className="text-xs text-gray-500 mt-2">
                              ID: {ticket.id}-{idx + 1}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Organiser */}
            {activeTab === 'organize' && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Créer un événement */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold mb-6">Créer un Événement</h3>
                  
                  <form onSubmit={(e) => { e.preventDefault(); createEvent(); }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Nom de l'événement</label>
                      <input
                        type="text"
                        value={newEvent.name}
                        onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                        placeholder="Festival d'été 2024"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Date et heure</label>
                      <input
                        type="datetime-local"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Prix de revente max (%)
                        <span className="text-gray-500 font-normal ml-1">({newEvent.maxResale}%)</span>
                      </label>
                      <input
                        type="range"
                        min="100"
                        max="200"
                        value={newEvent.maxResale}
                        onChange={(e) => setNewEvent({...newEvent, maxResale: e.target.value})}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>100% (prix original)</span>
                        <span>200% (2x le prix)</span>
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading || !newEvent.name || !newEvent.date}
                      className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50 font-medium"
                    >
                      Créer l'événement
                    </button>
                  </form>
                </div>
                
                {/* Mes événements */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Mes Événements</h3>
                    {myEvents.length > 0 && (
                      <button
                        onClick={() => setShowCreateTicket(!showCreateTicket)}
                        className="text-purple-600 hover:text-purple-700 font-medium text-sm"
                      >
                        {showCreateTicket ? 'Annuler' : '+ Ajouter des billets'}
                      </button>
                    )}
                  </div>
                  
                  {myEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Vous n'avez pas encore créé d'événements</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myEvents.map((event) => (
                        <div key={event.id} className="border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold">{event.name}</h4>
                              <p className="text-sm text-gray-600">
                                {formatDate(event.date)}
                              </p>
                            </div>
                            <span className="text-sm font-medium text-purple-600">
                              ID: {event.id}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                            <div className="bg-gray-50 rounded p-2">
                              <p className="text-gray-600">Revenus</p>
                              <p className="font-semibold">{event.totalRevenue} ETH</p>
                            </div>
                            <div className="bg-gray-50 rounded p-2">
                              <p className="text-gray-600">Votes</p>
                              <p className="font-semibold">{event.voteCount}</p>
                            </div>
                          </div>
                          
                          {event.totalRevenue !== '0' && (
                            <button className="w-full mt-3 bg-gray-100 text-gray-700 py-2 rounded hover:bg-gray-200 transition text-sm">
                              Retirer les fonds
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Formulaire création de billets */}
                  {showCreateTicket && myEvents.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-semibold mb-4">Ajouter un type de billet</h4>
                      <form onSubmit={(e) => { e.preventDefault(); createTicketType(); }} className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Événement</label>
                          <select
                            value={newTicketType.eventId}
                            onChange={(e) => setNewTicketType({...newTicketType, eventId: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                            required
                          >
                            <option value="">Sélectionner un événement</option>
                            {myEvents.map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium mb-1">Type</label>
                            <input
                              type="text"
                              value={newTicketType.name}
                              onChange={(e) => setNewTicketType({...newTicketType, name: e.target.value})}
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                              placeholder="VIP"
                              required
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-1">Prix (ETH)</label>
                            <input
                              type="number"
                              step="0.001"
                              value={newTicketType.price}
                              onChange={(e) => setNewTicketType({...newTicketType, price: e.target.value})}
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                              placeholder="0.05"
                              required
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Quantité max</label>
                          <input
                            type="number"
                            value={newTicketType.maxSupply}
                            onChange={(e) => setNewTicketType({...newTicketType, maxSupply: e.target.value})}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                            placeholder="100"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={newTicketType.hasOptions}
                              onChange={(e) => setNewTicketType({...newTicketType, hasOptions: e.target.checked})}
                              className="mr-2"
                            />
                            <span className="text-sm">Options incluses</span>
                          </label>
                        </div>
                        
                        {newTicketType.hasOptions && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Description des options</label>
                            <input
                              type="text"
                              value={newTicketType.options}
                              onChange={(e) => setNewTicketType({...newTicketType, options: e.target.value})}
                              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                              placeholder="Accès backstage + T-shirt"
                            />
                          </div>
                        )}
                        
                        <button
                          type="submit"
                          disabled={loading || !newTicketType.eventId || !newTicketType.name || !newTicketType.price || !newTicketType.maxSupply}
                          className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                        >
                          Créer le type de billet
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Page d'accueil non connecté */
          <div className="max-w-4xl mx-auto text-center py-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              La Billetterie Web3 pour vos Événements Locaux
            </h2>
            <p className="text-xl text-gray-600 mb-12">
              Créez, vendez et gérez vos billets NFT en toute sécurité.<br />
              Zéro fraude, frais réduits, récompenses pour tous.
            </p>
            
            <div className="grid md:grid-cols-4 gap-6 mb-12">
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-bold mb-2">Anti-fraude</h3>
                <p className="text-sm text-gray-600">Billets NFT infalsifiables et traçables</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <Coins className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="font-bold mb-2">Récompenses</h3>
                <p className="text-sm text-gray-600">Gagnez des tokens BLOCK à chaque achat</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h3 className="font-bold mb-2">Communauté</h3>
                <p className="text-sm text-gray-600">Votez et obtenez des réductions</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                <TrendingUp className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                <h3 className="font-bold mb-2">Frais réduits</h3>
                <p className="text-sm text-gray-600">Seulement 2.5% vs 10% habituels</p>
              </div>
            </div>
            
            <button
              onClick={connectWallet}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:shadow-lg transition transform hover:scale-105"
              disabled={loading}
            >
              Commencer maintenant
            </button>
          </div>
        )}
      </main>
      <DebugPanel />
      {/* Footer */}
      <footer className="bg-gray-100 mt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p>© 2024 BlockEvent - La billetterie Web3 pour tous</p>
            <p className="text-sm mt-2">
              Projet Alyra - Groupe 6
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;