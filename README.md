# algo-tax-project 2021

The current goal is to pull all of your transactions from 2021 and write the "taxable" ones to a csv file.

The criteria for "Taxable" transactions (in my opinion) are:
* Asset Transfer Transactions
* Payment Transactions
    * Only payments > 0.02 since these are directed to apps.
    * I did not think these are taxable since we're paying the contract to complete the swap/staking action.

I opted to skip the following transactions because either no money is actually being swapped or the transaction is being counted somewhere like coinbase / binance

* Application Calls
* Payment transactions < 0.02
* Any transaction with a Note
    * This is because I personally use the note field to send money between exchanges.


## IN PROGRESS
* SQLite3 database to hold all transactions
* Cross-checking which apps send/receive transactions (e.g. Yieldly,AlgoFi,Tinyman)

## Requirements

Node v16.14.0 and newer
NPM v8.3.1 and newer
SQLite3 v. 3.38 or newer. Can download here: 
https://www.sqlite.org/download.html 

You can download NodeJS for your computer here:
https://nodejs.org/en/download/

## Setup
Open a terminal to this project's root directory and execute `npm install` to load all the dependencies.

When you want to run this, execute the following command with your actual Algorand wallet public address.

 ```Javascript
 $ > node index.js "<your public wallet address>"
 ```