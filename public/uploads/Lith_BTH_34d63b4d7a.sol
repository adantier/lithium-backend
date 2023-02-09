
//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.1;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LithBTH is ERC20 {
    constructor(string memory name_, string memory symbol_, address _address, uint256 _amount) 
    ERC20(name_, symbol_) {
        _mint(_address, _amount);
    }
    
}