//Copyright 2016 Jackie Scholl
'use strict';
/*global AWS*/
const base64 = require('base64-js');
const resolveConflict = require('./resolve-conflict.js');

/** A CognitoStorage is basically a simple interface to Cognito Sync that's
    specialized to storing ContractEntries. */
function CognitoStorage(logins, allowAnonymous, onUpdateCallback) {
  this._debug_logins = logins;
  this.onUpdateCallback = onUpdateCallback || (() => {});
  console.assert(logins);
  console.log('creating new CognitoStorage instance');
  if (!logins) {
    alert('err! trying to set up but logins falsey; logins='+logins);
    throw new Error('err! trying to set up but logins falsey; logins='+logins);
  } else {
    if (!allowAnonymous) {
      console.assert(logins['accounts.google.com'] !== undefined,
          JSON.stringify(logins));
    } else {
      throw new Error('allowing anonymous');
    }
    this.setup(logins);
  }
}

CognitoStorage.prototype.setup = function(logins, callback) {
  // this line creates a callback that does nothing in case none was passed in
  callback = callback || (()=>{});
  console.log('running Cognito setup; logins:');
  console.log(logins);
  // Initialize the Amazon Cognito credentials provider
  AWS.config.logger = console;
  AWS.config.region = 'us-east-1'; // Region
  AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-east-1:a09f9758-c1f2-44c1-a3c8-185219e42c99',
    Logins: logins
  });
  console.log('AWS config set');
  AWS.config.credentials.get(() => {
    console.log('thing opened');
    const syncClient = new AWS.CognitoSyncManager();
    syncClient.openOrCreateDataset('contracts', (err, dataset) => {
      console.log('dataset opened');
      if (err) {
        console.log('could not open or create dataset; err '+err);
      } else {
        console.log('dataset opened');
        console.assert(dataset);
        this.dataset = dataset;
        this.updateContractMap();
        return callback();
      }
    });
  });
};

CognitoStorage.prototype.sync = function() {
  console.log('running cognito sync operation');
  console.log(this);
  console.assert(this.dataset);
  console.log('assert done');
  if (!this.dataset) {
    console.log('dataset is null! oh noes!');
  } else {
    console.log('Warning! We\'re running a sync operation, which costs money');
    this.dataset.synchronize({
      onFailure: (err) => {
        console.log('err!'); console.log(err);
      },
      onSuccess: (dataset, newRecords) => {
        console.log('success!');
        console.log(dataset);
        console.log(newRecords);
        console.log('this: ');
        console.log(this);
        this.updateContractMap();
      },
      onConflict: (dataset, conflicts, callback) => {
        const resolved = [];
        let continueMerge = true;

        for (let i=0; i<conflicts.length; i++) {
          try {
            resolved.push(resolveConflict.resolve(conflicts[i]));
          } catch (exception) {
            if (exception === resolveConflict.CANNOT_RESOLVE) {
              continueMerge = false;
              console.log('CANNOT_MERGE thrown; merge canceled');
            } else {
              throw exception;
            }
          }
        }

        if (continueMerge) {
          dataset.resolve(resolved, () => callback(true));
        } else {
          // callback false to stop the synchronization process.
          return callback(false);
        }
      },

      onDatasetDeleted: function(dataset, datasetName, callback) {
        console.log('oh no! remote dataset deleted!');
        console.log('dataset named '+datasetName);
        console.log(dataset);
        // Return true to delete the local copy of the dataset. Return false to
        //handle deleted datasets outside the synchronization callback.
        //return callback(true);
        return callback(false);
      },

      onDatasetMerged: function(dataset, datasetNames, callback) {
        console.log('oh no! dataset merged!');
        // Return true to continue the synchronization process.Return false to
        // handle dataset merges outside the synchroniziation callback.
        return callback(false);
        //return callback(true);
      }
    });
  }
};

CognitoStorage.prototype.updateContractMap = function() {
  console.log('updating contract map');

  console.assert(this.dataset);
  if (!this.dataset) {
    alert('updateContractMap called but dataset does not exist');
  } else {
    this.dataset.getAll((err, map) => {
      if (err) {
        console.log(err);
        throw new Error('error getting contracts');
      } else {
        const objectMap = new Map();
        for (const x in map) {
          if (map.hasOwnProperty(x) && map[x]) {
            if (x === '') {
              console.log('uh oh, very bad value');
              console.log(x);
              console.log(map[x]);
            } else {
              objectMap.set(x, JSON.parse(map[x]));
            }
          }
        }
        this.contractMap = objectMap;
        this.onUpdateCallback(objectMap);
      }
    });
  }
};

CognitoStorage.prototype.setContractEntry = function(contractEntry) {
  console.assert(this.dataset);
  if (!this.dataset) {
    alert('oops! dataset doesn\'t exist yet');
  } else {
    const contractString = JSON.stringify(contractEntry);
    this.dataset.put(contractEntry.contractId, contractString,
      () => {this.updateContractMap();}
    );
  }
};

CognitoStorage.prototype.getDefaultContractId = function() {
  console.assert(false); // test that assert works
  console.assert(this.contractMap);
  if (this.contractMap.length > 0) {
    const id = [...this.contractMap.values()]
        .sort((a, b) => b.dateLastModified - a.dateLastModified)[0].contractId;
    console.log('returning default contract id: '+id);
    return id;
  } else {
    console.log('getDefaultContractId has no contracts to draw from');
    return null;
  }
};

const getCognitoCompatibleRandomId = function() {
  const array = new Uint8Array(15);
  window.crypto.getRandomValues(array);
  // We replace plusses with underscores and slashes with dashes for
  // compatibility with AWS Cognito Sync
  return base64.fromByteArray(array).replace(/\+/, '_').replace(/\//, '-');
};

// do not allow anonymous
function CognitoStorageHandler(loginHandler, callback) {
  console.assert(loginHandler);
  this.loginHandler = loginHandler;
  this.onUpdateCallback = callback;
  this.setupStorage(loginHandler.value);
  loginHandler.addListener((x) => {
    console.log('recieved event, running cognito setup');
    this.setupStorage(x);
  });
}

CognitoStorageHandler.prototype.setupStorage = function(loginState) {
  if (loginState.loggedIn) {
    console.log('user logged in; setting up storage');
    this.contractStorage = new CognitoStorage(loginState.logins, false,
        this.onUpdateCallback);
  } else {
    console.log('user not logged in; clearing storage');
    this.contractStorage = null;
    this.onUpdateCallback(new Map());
  }
};

CognitoStorageHandler.prototype.isEmpty = function() {
  return !this.contractStorage;
};

CognitoStorageHandler.prototype.setContractEntry = function(contractEntry) {
  if (this.contractStorage) {
    this.contractStorage.setContractEntry(contractEntry);
  } else {
    throw new Error('Tried to set a contract entry while storage was empty');
  }
};

module.exports = {
  getNewId: getCognitoCompatibleRandomId,
  ContractStorage: CognitoStorage,
  ContractStorageHandler: CognitoStorageHandler
};
