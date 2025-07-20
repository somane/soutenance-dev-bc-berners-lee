// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BlockToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;
    uint256 public constant CREATOR_MAX_PERCENTAGE = 15;
    
    mapping(address => uint256) public lastActivityTime;
    mapping(address => bool) public isEventCreator;
    
    constructor() ERC20("BlockEvent Token", "BLK") {}
    
    function mint(address to, uint256 amount) public onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Offre maximale depassee");
        _mint(to, amount);
        lastActivityTime[to] = block.timestamp;
    }
    
    function setEventCreator(address creator) public onlyOwner {
        isEventCreator[creator] = true;
    }
    
    function burnInactiveTokens(address user) public {
        if (block.timestamp - lastActivityTime[user] > 365 days) {
            uint256 burnAmount = balanceOf(user) / 10;
            _burn(user, burnAmount);
        }
    }
}