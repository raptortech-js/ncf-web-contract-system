//Copyright 2016 Jackie Scholl
//var $ = require('jquery');
var React = require('react');
var ReactDOM = require('react-dom');
var loginHandler = require('./login.js').render();
//const apiRoot = '';
var contractStorageCognito = require('./contract-storage-cognito');

//const googleLogin = true;

var FullPage = React.createClass({
  getInitialState: function() {
    console.log('window.location.hash: '+window.location.hash);
    const h = window.location.hash;
    const contractId = h? h.slice(1) : null;
    /* const contractDataset = null;
    return {contractId: contractId, contractDataset: null, contractMap: new Map(), logins: {}};*/
    return {
      contractId: contractId,
      contractMap: new Map(),
      logins: null
    };
  },
  updateContractMap: function(contractMap) {
    this.setState({contractMap: contractMap});
  },
  changeContractId: function(contractId) {
    window.location.hash = '#' + contractId;
    this.setState({contractId: contractId});
  },
  componentWillMount: function() {
    loginHandler.addListener((x) => {this.setState({logins: x.logins});});
    const contractStorageHandler = new contractStorageCognito.ContractStorageHandler(
        loginHandler, this.updateContractMap);
    this.setState({contractStorageHandler: contractStorageHandler});
  },

  /*componentDidMount: function() {
    if (googleLogin) {
      if (loginHandler.value.loggedIn) {
        console.log('token already exists!');
        this.cognitoSetup(loginHandler.value.logins);
      } else {
        console.log('adding listener');
        loginHandler.addListener((x) => {
          console.log('recieved event, running cognito setup');
          if (x.loggedIn) {
            this.cognitoSetup(x.logins);
          } else {
            console.log('user not logged in; running tear-down');
            this.cognitoTearDown();
          }
        });
      }
    } else {
      console.log('google login not required, skipping to setup');
      this.cognitoSetup();
    }
  },
  changeContractId: function(contractId) {
    window.location.hash = '#' + contractId;
    this.setState({contractId: contractId});
  },
  handleContractListUpdate: function(contracts) {
    if (this.state.contractId === null && contracts.length > 0) {
      this.changeContractId(contracts[0].contractId);
    }
  },
  handleContractBoxUpdate: function(newContractEntry) {
    this.setContractEntry(newContractEntry);
  },
  createContract: function() {
    var array = new Uint8Array(15);
    window.crypto.getRandomValues(array);
    const contractId = base64.fromByteArray(array).replace(/\+/, '_').replace(/\//, '-');
    console.log('new contract ID:' + contractId);
    //const contractId = 5;
    const baseContractData = {
      semester: '', studyLocation: 'On Campus', contractYear: '',
      firstName: '', lastName: '', nNumber: '', expectedGradYear: '', boxNumber: '',
      classes: [{courseCode: '', courseName: '', isInternship: false, instructorName: '',
            sessionName: ''}]
    };
    const contractEntry = {contractId: contractId, googleId: 'nah',
        contractData: baseContractData, dateLastModified: new Date().getTime()};
    console.log(contractEntry);
    this.setContractEntry(contractEntry);
    this.changeContractId(contractId);
  },*/
  test1: function(x) {
    console.log('test1');
    console.log(this.contractStorageHandler);
    this.contractStorageHandler.setContractEntry(x);
  },
  render: function() {
    var optionalContract = null;
    if (this.state.contractId != null && this.state.contractMap.has(this.state.contractId)) {
      optionalContract =
          <ContractBox
            contractEntry={this.state.contractMap.get(this.state.contractId)}
            handleUpdate={/*this.handleContractBoxUpdate*/
                          /*this.contractStorageHandler.setContractEntry*/
                          /*this.test1*/
                          this.state.contractStorageHandler.setContractEntry}
            logins={this.state.logins}
            pollInterval={2000}
          />
    }
    //console.log('current id: '+this.state.contractId);
    return (
      <div className='container-fluid'>
        <div className='row'>
          <ContractList changeContractId={this.changeContractId}
            onUpdate={this.handleContractListUpdate}
            createContract={this.createContract}
            currentContractId={this.state.contractId}
            contractMap={this.state.contractMap}
            putContract={this.handleContractFormUpdate}
            pollInterval={2000}
          />
          {optionalContract}
          <div className='col-md-5 col-md-offset-2'>
            <button className='btn btn-default' type='button' onClick={this.cognitoSync}>Sync</button>
          </div>
        </div>
      </div>
    );
  }
});

var ContractList = React.createClass({
  createContract: function(e) {
    e.preventDefault();
    this.props.createContract();
  },
  render: function() {
    var contractEntries = [...this.props.contractMap.values()]
        .sort((a, b) => b.dateLastModified - a.dateLastModified)
        .map((x) =>
          (<ContractElement value={x} key={x.contractId}
              changeContractId={this.props.changeContractId}
              isCurrent={x.contractId === this.props.currentContractId}/>));
    return (
      <div className='col-sm-3 col-md-2 sidebar'>
        <ul className='nav nav-sidebar'>
          <li>Contract List</li>
          <li><a href='' onClick={this.createContract} id='new-contract-link' className='logged-in'>New Contract</a></li>
        </ul>
        <ul className='nav nav-sidebar'>
          {contractEntries}
        </ul>
      </div>
    );
  }
});

var ContractElement = React.createClass({
  handleClick: function(e) {
    e.preventDefault();
    this.props.changeContractId(this.props.value.contractId);
  },
  render: function() {
    var classesString = '';
    const classes = this.props.value.contractData.classes.map((x, _1, _2) =>
          (x.courseName)).filter((x, _1, _2) => (x !== ''));
    if (classes.length > 0) {
      classesString = '[' + classes.join().substring(0, 15) + ']; ';
    }
    const wholeString = this.props.value.contractData.semester + ' ' +
        this.props.value.contractData.contractYear + '; ' +
        classesString + '' +
        timeSince(new Date(this.props.value.dateLastModified)) + ' ago';
    return (
      <li id={this.props.value.contractId} className={this.props.isCurrent?'active':''}>
        <a href={'#' + this.props.value.contractId} onClick={this.handleClick}>
          {wholeString}
        </a>
      </li>
    );
  }
});

function timeSince(date) {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = Math.floor(seconds / 31536000);
  if (interval > 1) {
    return interval + ' years';
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + ' months';
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + ' days';
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + ' hours';
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + ' minutes';
  }
  return 'just now';
  //return Math.floor(seconds) + ' seconds';
}

function ClassData(courseCode, courseName, isInternship, instructorName, sessionName) {
  console.assert(isInternship === true || isInternship === false, 'bad value: ' + isInternship);
  return {courseCode: courseCode, courseName: courseName, isInternship: isInternship,
      instructorName: instructorName, sessionName: sessionName};
}

var emptyClassData = function() {
  return new ClassData('', '', false, '', '');
}

var classDataFrom = function(data) {
  //console.log('About to pull class data');
  //console.log(data);
  return new ClassData(data.courseCode, data.courseName, data.isInternship,
        data.instuctorName, data.sessionName);
}

var resizeArray = function(array, minSize, maxSize, testerCallback, spaceFillerCallback) {
  //console.log('existing array length: '+array.length);
  for (var i = array.length-1; i >= 0; i--) {
    var x = array[i];
    var hasData = testerCallback(x);
    if (hasData) {
      //console.log(x);
      break;
    }
  }
  //console.log('index of last class with data: ' + i);
  var newLength = i + 2; // there should be exactly one empty element at the end of the array
  if (newLength > maxSize) {
    newLength = maxSize;
  }
  if (newLength < minSize) {
    newLength = minSize;
  }
  if (array.length == newLength) {
    // we're good!
  } else if (array.length > newLength) {
    array = array.slice(0, newLength);
  } else if (array.length < newLength) {
    while (array.length < newLength) {
      array = array.concat(spaceFillerCallback());
    }
  }
  return array;
}

var testResizeArray = function() {
  var zeroTester = (x) => (x != 0);
  var zeroFiller = () => (0);
  console.assert(arraysEqual(resizeArray([0, 0, 1, 0, 0, 0], 0, 100, zeroTester,
        zeroFiller), [0, 0, 1, 0]));
  console.assert(arraysEqual(resizeArray([1, 0, 0, 6], 0, 100, zeroTester,
        zeroFiller), [1, 0, 0, 6, 0]));
}

testResizeArray();

function arraysEqual(a1,a2) {
    return JSON.stringify(a1)==JSON.stringify(a2);
}

var ContractBox = React.createClass({
  handleUpdate: function(newData) {
    var updatedContractEntry = Object.assign({}, this.props.contractEntry);
    updatedContractEntry.contractData = newData;
    updatedContractEntry.dateLastModified = new Date().getTime();
    this.props.handleUpdate(updatedContractEntry);
  },

  render: function() {
    console.log(this.props.contractEntry);
    return (
      <div className='col-sm-9 col-sm-offset-3 col-md-10 col-md-offset-2 main'>
        <ContractForm pollInterval={this.props.pollInterval}
          contractId={this.props.contractEntry.contractId}
          value={this.props.contractEntry.contractData}
          handleUpdate={this.handleUpdate}
        />
        <LivePreview value={this.props.contractEntry} logins={this.props.logins} />
      </div>
    );
  }
});

var LivePreview = React.createClass({
  render: function() {
    const renderContractRequest = {
      contractData: this.props.value.contractData,
      authentication: this.props.logins,
      options: {
        flatten_pdf: true
      }
    }
    const requestJson = JSON.stringify(renderContractRequest);
    const contractPdfUrl = '/render-contract?renderContractRequest='+requestJson;
    return (
      <iframe src={contractPdfUrl} width='100%' height='1000px'>
        <a href={contractPdfUrl}>
          Click here to see PDF
        </a>
      </iframe>
    );
  }
});


var ContractForm = React.createClass({
  updateHandlerGenerator: function(identifier) {
    return ((value) => {
      var newState = Object.assign({}, this.props.value);
      newState[identifier] = value;
      this.props.handleUpdate(newState);
    });
  },

  magic: function(identifier) {
    return {value: this.props.value[identifier],
      handleUpdate: this.updateHandlerGenerator(identifier),
      id: 'ContractForm.'+this.props.contractId+'.'+identifier};
  },

  render: function() {
    // What the f*ck does this line do? do we use it?
    var contractYearNodes = Array.apply(null, Array(5)).map((_, i) => (i));
    return (
      <div className='contractForm'>
      <h1 className='page-header'>Contract Form</h1>
      <form id='contractForm' className='blank-form'>
      <div className='row' style={{marginBottom: '2em'}}>
      <div className='col-sm-3'><TextInput displayName='First Name' placeHolder='Jane'
          magic={this.magic('firstName')} /></div>
      <div className='col-sm-3'><TextInput displayName='Last Name' placeHolder='Doe'
          magic={this.magic('lastName')} /></div>
      <div className='col-sm-3'><TextInput displayName='N Number' placeHolder='123456789'
          magic={this.magic('nNumber')} /></div>
      <div className='col-sm-3 col-md-3'><TextInput displayName='Box Number' placeHolder='123'
          magic={this.magic('boxNumber')} /></div>

      <div className='col-sm-3'>
      <SelectInput displayName='Semester' magic={this.magic('semester')}>
        <SelectOption value='' display='Select One' />
        <SelectOption value='Spring' display='Spring' />
        <SelectOption value='Fall' display='Fall' />
      </SelectInput></div>
      <div className='col-sm-3'><TextInput displayName='Contract Year' magic={this.magic('contractYear')} /></div>
      <div className='col-sm-3'>
      <SelectInput displayName='Study Location' magic={this.magic('studyLocation')}>
        <SelectOption value='' display='Select One' />
        <SelectOption value='On Campus' display='On Campus' />
        <SelectOption value='Off Campus' display='Off Campus' />
      </SelectInput></div>
      <div className='col-sm-3'><TextInput displayName='Expected Year of Graduation' placeHolder='never'
          magic={this.magic('expectedGradYear')} /></div>
      </div>


        <ClassesTable magic={this.magic('classes')}/>

        <TextArea displayName='Goals' placeHolder='live the good life'
            magic={this.magic('goals')} />
        <TextArea displayName='Certification Criteria'
            placeHolder='Three out of four credits.'
            magic={this.magic('certificationCriteria')} />
        <TextArea displayName='Description and Other Activities'
            placeHolder='skydive'
            magic={this.magic('descriptionsOtherActivities')} />

        <TextInput displayName='Advisor Name' placeHolder='Prezzy Oshea'
            magic={this.magic('advisorName')} />
      </form>
      <div id='display-pdf' />
      </div>
    );
  }
});

var ClassesTable = React.createClass({
  updateHandlerGenerator: function(index) {
    return ((value) => {
      var newState = this.props.magic.value.slice();
      newState[index] = value;
      var testerCallback = (x) => (x.courseCode || x.courseName
        || x.isInternship || x.instructorName );
      var testerCallback2 = (x) => (x.courseName !== '');
      newState = resizeArray(newState, 4, 9, testerCallback, emptyClassData);
      this.props.magic.handleUpdate(newState);
    });
  },
  magic: function(index) {
    return {value: this.props.magic.value[index],
      handleUpdate: this.updateHandlerGenerator(index),
      id: this.props.magic.id+'.'+index};
  },
  handleChange: function(event) {
    this.props.magic.handleUpdate(event.target.value);
  },
  handleUpdate: function(newValue) {
    this.props.magic.handleUpdate(newValue);
  },
  render: function() {
    var magic_x = this.magic
    var classNodes = this.props.magic.value.map(
      ((_, i) => (<Class number={i} magic={this.magic(i)} key={i}/>)).bind(this)
    );
    return (
      <div className='table-responsive'>
      <table className='table table-striped'>
        <thead>
          <tr>
            <th>Course #</th>
            <th>Course name</th>
            <th>Internship</th>
            <th>Session</th>
            <th>Instructor Name</th>
          </tr>
        </thead>
        <tbody>
          {classNodes}
        </tbody>
      </table>
      </div>
    );
  }
});

var Class = React.createClass({
  updateHandlerGenerator: function(identifier) {
    return ((value) => {
      var newState = classDataFrom(this.props.magic.value);
      newState[identifier] = value;
      this.props.magic.handleUpdate(newState);
    });
  },
  magic: function(identifier) {
    return {value: this.props.magic.value[identifier],
      handleUpdate: this.updateHandlerGenerator(identifier),
      id: this.props.magic.id+'.'+identifier};
  },
  render: function() {
    var row = this.props.number;
    return (
      <tr>
        <td><TextInput placeHolder='12345' magic={this.magic('courseCode')}/></td>
        <td><TextInput placeHolder='Basket-weaving 101'
            magic={this.magic('courseName')}/> </td>
        <td><CheckBox magic={this.magic('isInternship')}/></td>
        <td><SelectInput displayName='' magic={this.magic('sessionName')}>
          <SelectOption value='' display='Select One' />
          <SelectOption value='A' display='Full Term' />
          <SelectOption value='M1' display='Module 1' />
          <SelectOption value='M2' display='Module 2' />
          <SelectOption value='1MC' display='Full Term For Module Credit' />
        </SelectInput></td>
        <td><TextInput placeHolder='President #trublu'
            magic={this.magic('instructorName')}/></td>
      </tr>
    );
  }
});

var GenericInput = React.createClass({
  render: function() {
    // We want to hide the label when displayName is empty
    const style = this.props.hasOwnProperty('displayName') &&
      (this.props.displayName && this.props.displayName.length !== 0)? {} : {display: 'none'};
    return (
      <span>
        <label htmlFor={this.props.htmlId} style={style}>
          {this.props.displayName}
        </label>
        {this.props.children}
      </span>
    );
  }
});

var TextInput = React.createClass({
  render: function() {
    const htmlId = this.props.magic.id;
    //console.log('about to render textinput');
    //console.log('value: '+this.props.magic.value);
    return (
      <GenericInput displayName={this.props.displayName} htmlId={htmlId}>
        <input
          value={this.props.magic.value}
          onChange={(e) => {this.props.magic.handleUpdate(e.target.value);}}
          placeholder={this.props.placeHolder}
          id={htmlId}
          className='form-control'
        />
      </GenericInput>
    );
  }
});

var TextArea = React.createClass({
  render: function() {
    const htmlId = this.props.magic.id;
    return (
      <GenericInput displayName={this.props.displayName} htmlId={htmlId}>
      <textarea
        value={this.props.magic.value}
        onChange={(e) => {this.props.magic.handleUpdate(e.target.value);}}
        placeholder={this.props.placeHolder}
        id={htmlId}
        className='form-control'
      />
      </GenericInput>
    );
  }
});

var CheckBox = React.createClass({
  render: function() {
    const htmlId = this.props.magic.id;
    return (
      <GenericInput displayName={this.props.displayName} htmlId={htmlId}>
      <input
        checked={this.props.magic.value}
        onChange={(e) => {this.props.magic.handleUpdate(e.target.checked);}}
        id={htmlId}
        className='form-control'
      />
      </GenericInput>
    );
  }
});

var SelectInput = React.createClass({
  render: function() {
    const htmlId = this.props.magic.id;
    return (
      <GenericInput displayName={this.props.displayName} htmlId={htmlId}>
        <select
          value={this.props.magic.value}
          onChange={(e) => {this.props.magic.handleUpdate(e.target.value);}}
          id={htmlId}
          className='form-control'
        >
        {this.props.children}
        </select>
      </GenericInput>
    );
  }
});

var SelectOption = React.createClass({
  render: function() {
    return (
      <option value={this.props.value} selected={this.props.selected}>
        {this.props.display}
      </option>
    );
  }
});

var BasicComponent = React.createClass({
  render: function() {
    return (
      null
    );
  }
});

ReactDOM.render(
  <FullPage />,
  document.getElementById('content')
);
