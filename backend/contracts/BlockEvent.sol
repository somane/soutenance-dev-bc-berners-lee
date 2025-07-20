// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./BlockToken.sol";

// Contract principal de BlockEvent pour la gestion de billetterie NFT
contract BlockEvent is ERC1155, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // Référence au token de gouvernance
    BlockToken public governanceToken;
    
    // Constantes pour le système de tokens
    uint256 public constant TOKENS_PER_10_EUROS = 1 * 10**18; // 1 token pour 10€
    uint256 public constant VOTE_DISCOUNT_PERCENTAGE = 5;      // 5% de réduction si vote
    uint256 public constant DAO_TREASURY_PERCENTAGE = 20;      // 20% pour la DAO
    uint256 public constant ORGANIZER_TOKEN_PERCENTAGE = 10;   // 10% pour les organisateurs
    
    // Compteurs pour les IDs uniques
    Counters.Counter private _eventIdCounter;
    Counters.Counter private _ticketTypeIdCounter;
    Counters.Counter private _certificateIdCounter;
    
    // Structure pour définir un événement
    struct Event {
        string name;
        address organizer;
        uint256 date;
        uint256 maxResalePercentage;
        bool isActive;
        bool isCancelled;               // Nouveau: événement annulé ?
        uint256[] ticketTypeIds;
        uint256 totalRevenue;           // Nouveau: revenus totaux
        uint256 withdrawnAmount;        // Nouveau: montant déjà retiré
        mapping(address => bool) hasVoted; // Nouveau: qui a voté
        uint256 voteCount;              // Nouveau: nombre de votes
    }
    
    // Structure pour définir un type de billet
    struct TicketType {
        uint256 eventId;
        string name;
        uint256 price;
        uint256 maxSupply;
        uint256 currentSupply;
        bool hasOptions;
        string optionDescription;
        uint256 resalePrice;            // Nouveau: prix de revente fixe
        uint256 royaltyPercentage;      // Nouveau: % de royalties
    }
    
    // Structure pour les certificats de participation
    struct Certificate {
        uint256 eventId;
        uint256 certificateId;
        uint256 mintDate;
        bool isSpecial;                 // Certificat spécial (VIP, etc.)
    }
    
    // Mappings pour stocker les données
    mapping(uint256 => Event) public events;
    mapping(uint256 => TicketType) public ticketTypes;
    mapping(uint256 => uint256) public ticketOriginalPrice;
    mapping(uint256 => mapping(address => bool)) public hasUsedTicket;
    mapping(uint256 => Certificate) public certificates;     // Nouveau: certificats
    mapping(address => uint256[]) public userCertificates;  // Nouveau: certificats par user
    mapping(address => uint256) public userSpentAmount;     // Nouveau: montant dépensé par user
    mapping(address => bool) public hasReceivedVoteDiscount; // Nouveau: réduction vote utilisée
    
    // Treasury pour la DAO
    address public daoTreasury;
    
    // Events (logs)
    event EventCreated(uint256 eventId, string name, address organizer);
    event EventCancelled(uint256 eventId);
    event TicketTypeCreated(uint256 ticketTypeId, uint256 eventId, string name);
    event TicketPurchased(address buyer, uint256 ticketTypeId, uint256 amount);
    event TicketUsed(address user, uint256 ticketTypeId);
    event CertificateMinted(address user, uint256 certificateId, uint256 eventId);
    event TokensEarned(address user, uint256 amount);
    event UserVoted(address user, uint256 eventId);
    event FundsWithdrawn(address organizer, uint256 amount);
    
    constructor(address _daoTreasury) ERC1155("https://api.blockevent.com/metadata/{id}.json") {
        daoTreasury = _daoTreasury;
        // Déployer le token de gouvernance
        governanceToken = new BlockToken();
    }
    
    // Fonction pour créer un nouvel événement
    function createEvent(
        string memory _name,
        uint256 _date,
        uint256 _maxResalePercentage
    ) public {
        require(_date > block.timestamp, "La date doit etre dans le futur");
        require(_maxResalePercentage >= 100 && _maxResalePercentage <= 200, 
                "Le prix de revente doit etre entre 100% et 200%");
        
        _eventIdCounter.increment();
        uint256 newEventId = _eventIdCounter.current();
        
        Event storage newEvent = events[newEventId];
        newEvent.name = _name;
        newEvent.organizer = msg.sender;
        newEvent.date = _date;
        newEvent.maxResalePercentage = _maxResalePercentage;
        newEvent.isActive = true;
        newEvent.isCancelled = false;
        
        // Marquer l'adresse comme créateur d'événement
        governanceToken.isEventCreator(msg.sender);
        
        emit EventCreated(newEventId, _name, msg.sender);
    }
    
    // Nouvelle fonction: Annuler un événement et rembourser
    function cancelEvent(uint256 _eventId) public nonReentrant {
        Event storage eventInfo = events[_eventId];
        
        // Vérifications
        require(eventInfo.organizer == msg.sender, "Seul l'organisateur peut annuler");
        require(!eventInfo.isCancelled, "Evenement deja annule");
        require(block.timestamp < eventInfo.date, "Evenement deja passe");
        
        // Marquer comme annulé
        eventInfo.isCancelled = true;
        eventInfo.isActive = false;
        
        emit EventCancelled(_eventId);
    }
    
    // Fonction pour ajouter un type de billet avec royalties
    function createTicketType(
        uint256 _eventId,
        string memory _name,
        uint256 _price,
        uint256 _maxSupply,
        bool _hasOptions,
        string memory _optionDescription,
        uint256 _royaltyPercentage  // Nouveau paramètre
    ) public {
        require(events[_eventId].organizer != address(0), "L'evenement n'existe pas");
        require(events[_eventId].organizer == msg.sender, "Seul l'organisateur peut creer des billets");
        require(events[_eventId].isActive, "L'evenement n'est pas actif");
        require(_royaltyPercentage <= 10, "Royalties max 10%"); // Limite raisonnable
        
        _ticketTypeIdCounter.increment();
        uint256 newTicketTypeId = _ticketTypeIdCounter.current();
        
        TicketType storage newTicketType = ticketTypes[newTicketTypeId];
        newTicketType.eventId = _eventId;
        newTicketType.name = _name;
        newTicketType.price = _price;
        newTicketType.maxSupply = _maxSupply;
        newTicketType.currentSupply = 0;
        newTicketType.hasOptions = _hasOptions;
        newTicketType.optionDescription = _optionDescription;
        newTicketType.royaltyPercentage = _royaltyPercentage;
        newTicketType.resalePrice = _price; // Prix initial par défaut
        
        events[_eventId].ticketTypeIds.push(newTicketTypeId);
        ticketOriginalPrice[newTicketTypeId] = _price;
        
        emit TicketTypeCreated(newTicketTypeId, _eventId, _name);
    }
    
    // Nouvelle fonction: Définir le prix de revente
    function setResalePrice(uint256 _ticketTypeId, uint256 _newPrice) public {
        TicketType storage ticketType = ticketTypes[_ticketTypeId];
        Event storage eventInfo = events[ticketType.eventId];
        
        require(eventInfo.organizer == msg.sender, "Seul l'organisateur peut modifier");
        require(_newPrice <= (ticketType.price * eventInfo.maxResalePercentage) / 100,
                "Prix depasse la limite autorisee");
        
        ticketType.resalePrice = _newPrice;
    }
    
    // Fonction pour acheter des billets (mise à jour avec tokens)
    function buyTickets(uint256 _ticketTypeId, uint256 _amount) public payable nonReentrant {
        TicketType storage ticketType = ticketTypes[_ticketTypeId];
        require(ticketType.price > 0, "Ce type de billet n'existe pas");
        require(ticketType.currentSupply + _amount <= ticketType.maxSupply, 
                "Pas assez de billets disponibles");
        
        Event storage eventInfo = events[ticketType.eventId];
        require(!eventInfo.isCancelled, "Evenement annule");
        require(block.timestamp < eventInfo.date, "L'evenement est termine");
        
        // Calculer le prix avec réduction si l'utilisateur a voté
        uint256 unitPrice = ticketType.price;
        if (hasReceivedVoteDiscount[msg.sender] && eventInfo.hasVoted[msg.sender]) {
            unitPrice = (unitPrice * (100 - VOTE_DISCOUNT_PERCENTAGE)) / 100;
            hasReceivedVoteDiscount[msg.sender] = false; // Utiliser la réduction une fois
        }
        
        uint256 totalPrice = unitPrice * _amount;
        require(msg.value >= totalPrice, "Montant insuffisant");
        
        // Minter les NFTs
        _mint(msg.sender, _ticketTypeId, _amount, "");
        ticketType.currentSupply += _amount;
        
        // Mettre à jour les revenus
        eventInfo.totalRevenue += totalPrice;
        
        // Calculer et distribuer les tokens BLK
        uint256 tokensToMint = (totalPrice * TOKENS_PER_10_EUROS) / (10 * 10**18); // Assumant 1 ETH = 1000€
        
        // 80% pour l'acheteur
        uint256 buyerTokens = (tokensToMint * 80) / 100;
        governanceToken.mint(msg.sender, buyerTokens);
        
        // 10% pour l'organisateur
        uint256 organizerTokens = (tokensToMint * ORGANIZER_TOKEN_PERCENTAGE) / 100;
        governanceToken.mint(eventInfo.organizer, organizerTokens);
        
        // 10% pour la DAO (les 10% restants du 20% vont directement au treasury)
        uint256 daoTokens = (tokensToMint * 10) / 100;
        governanceToken.mint(daoTreasury, daoTokens);
        
        // Enregistrer le montant dépensé
        userSpentAmount[msg.sender] += totalPrice;
        
        emit TicketPurchased(msg.sender, _ticketTypeId, _amount);
        emit TokensEarned(msg.sender, buyerTokens);
        
        // Rembourser l'excédent
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }
    }
    
    // Nouvelle fonction: Retirer les fonds (organisateur)
    function withdrawFunds(uint256 _eventId) public nonReentrant {
        Event storage eventInfo = events[_eventId];
        
        require(eventInfo.organizer == msg.sender, "Seul l'organisateur peut retirer");
        require(!eventInfo.isCancelled, "Evenement annule");
        require(block.timestamp > eventInfo.date, "Attendez la fin de l'evenement");
        
        uint256 availableAmount = eventInfo.totalRevenue - eventInfo.withdrawnAmount;
        require(availableAmount > 0, "Aucun fond disponible");
        
        // Prélever les frais de la plateforme (ex: 2.5%)
        uint256 platformFee = (availableAmount * 25) / 1000; // 2.5%
        uint256 organizerAmount = availableAmount - platformFee;
        
        // Mettre à jour le montant retiré
        eventInfo.withdrawnAmount += availableAmount;
        
        // Transférer les fonds
        payable(daoTreasury).transfer(platformFee);
        payable(msg.sender).transfer(organizerAmount);
        
        emit FundsWithdrawn(msg.sender, organizerAmount);
    }
    
    // Fonction pour valider un billet
    function validateTicket(uint256 _ticketTypeId, address _ticketHolder) public {
        TicketType storage ticketType = ticketTypes[_ticketTypeId];
        Event storage eventInfo = events[ticketType.eventId];
        
        require(eventInfo.organizer == msg.sender, "Seul l'organisateur peut valider");
        require(balanceOf(_ticketHolder, _ticketTypeId) > 0, "L'utilisateur n'a pas ce billet");
        require(!hasUsedTicket[_ticketTypeId][_ticketHolder], "Billet deja utilise");
        require(block.timestamp >= eventInfo.date - 2 hours && 
                block.timestamp <= eventInfo.date + 6 hours, 
                "Validation uniquement le jour de l'evenement");
        
        hasUsedTicket[_ticketTypeId][_ticketHolder] = true;
        emit TicketUsed(_ticketHolder, _ticketTypeId);
    }
    
    // Nouvelle fonction: Créer un certificat de participation
    function mintCertificate(uint256 _eventId, address _participant, bool _isSpecial) public {
        Event storage eventInfo = events[_eventId];
        
        // Vérifications
        require(eventInfo.organizer == msg.sender, "Seul l'organisateur peut emettre");
        require(block.timestamp > eventInfo.date, "Attendez la fin de l'evenement");
        
        // Vérifier que le participant avait bien un billet utilisé
        bool hadTicket = false;
        for (uint256 i = 0; i < eventInfo.ticketTypeIds.length; i++) {
            if (hasUsedTicket[eventInfo.ticketTypeIds[i]][_participant]) {
                hadTicket = true;
                break;
            }
        }
        require(hadTicket, "Le participant n'a pas assiste");
        
        // Créer le certificat
        _certificateIdCounter.increment();
        uint256 newCertId = _certificateIdCounter.current();
        
        // ID unique pour le NFT certificat (différent des billets)
        uint256 certificateTokenId = 1000000 + newCertId; // Offset pour éviter collision
        
        certificates[newCertId] = Certificate({
            eventId: _eventId,
            certificateId: newCertId,
            mintDate: block.timestamp,
            isSpecial: _isSpecial
        });
        
        // Minter le NFT certificat
        _mint(_participant, certificateTokenId, 1, "");
        userCertificates[_participant].push(newCertId);
        
        // Bonus tokens pour certificat spécial
        if (_isSpecial) {
            governanceToken.mint(_participant, 10 * 10**18); // 10 tokens bonus
        }
        
        emit CertificateMinted(_participant, newCertId, _eventId);
    }
    
    // Nouvelle fonction: Voter pour un événement
    function voteForEvent(uint256 _eventId) public {
        Event storage eventInfo = events[_eventId];
        
        // Vérifier que l'utilisateur a des tokens
        require(governanceToken.balanceOf(msg.sender) > 0, "Vous devez avoir des tokens BLK");
        
        // Vérifier que l'utilisateur a participé à l'événement
        bool participated = false;
        for (uint256 i = 0; i < eventInfo.ticketTypeIds.length; i++) {
            if (balanceOf(msg.sender, eventInfo.ticketTypeIds[i]) > 0) {
                participated = true;
                break;
            }
        }
        require(participated, "Vous devez avoir participe a l'evenement");
        
        // Vérifier qu'il n'a pas déjà voté
        require(!eventInfo.hasVoted[msg.sender], "Vous avez deja vote");
        
        // Enregistrer le vote
        eventInfo.hasVoted[msg.sender] = true;
        eventInfo.voteCount++;
        hasReceivedVoteDiscount[msg.sender] = true; // Activer la réduction pour prochain achat
        
        // Récompenser l'organisateur avec des tokens
        governanceToken.mint(eventInfo.organizer, 5 * 10**18); // 5 tokens par vote
        
        emit UserVoted(msg.sender, _eventId);
    }
    
    // Override pour gérer les royalties sur les transferts
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        // Si c'est un transfert de billet (pas depuis l'adresse 0)
        if (from != address(0) && id < 1000000) { // Les certificats ont un ID > 1000000
            TicketType storage ticketType = ticketTypes[id];
            
            // Si des royalties sont définies et que ce n'est pas l'organisateur
            if (ticketType.royaltyPercentage > 0 && to != events[ticketType.eventId].organizer) {
                // TODO: Implémenter le système de paiement des royalties
                // Dans une vraie implémentation, il faudrait un système de paiement intégré
            }
        }
        
        super.safeTransferFrom(from, to, id, amount, data);
    }
    
    // Fonction helper pour obtenir les infos complètes d'un événement
    function getEventInfo(uint256 _eventId) public view returns (
        string memory name,
        address organizer,
        uint256 date,
        bool isActive,
        bool isCancelled,
        uint256 totalRevenue,
        uint256 voteCount,
        uint256[] memory ticketTypeIds
    ) {
        Event storage eventInfo = events[_eventId];
        return (
            eventInfo.name,
            eventInfo.organizer,
            eventInfo.date,
            eventInfo.isActive,
            eventInfo.isCancelled,
            eventInfo.totalRevenue,
            eventInfo.voteCount,
            eventInfo.ticketTypeIds
        );
    }
    
    // Fonction pour obtenir le solde de tokens d'un utilisateur
    function getTokenBalance(address user) public view returns (uint256) {
        return governanceToken.balanceOf(user);
    }
}
