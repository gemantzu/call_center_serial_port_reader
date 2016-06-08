var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var fs = require('fs');
var chokidar = require('chokidar');
var utf8 = require('utf8');
var http = require('http');
var folder = 'calls';

var port = new SerialPort('\\\\.\\COM1', { 
  baudrate: 9600,
  parser: serialport.parsers.readline("\n")
}, true);

var calculateSeconds = function(arrayOfTime) {
  var hours = arrayOfTime[0] * 1;
  var minutes = arrayOfTime[1] * 1;
  var seconds = arrayOfTime[2] * 1;
  return (hours * 3600) + (minutes * 60) + seconds;
};

var formatDatetime = function(dateFromCallCenter) {
  var date = dateFromCallCenter.slice(0, 8);
  var time = dateFromCallCenter.slice(8, 16).join('');
  var datetime = [
    '20',
    date.slice(6, 8).join(''),
    '-',
    date.slice(3, 5).join(''),
    '-',
    date.slice(0, 2).join(''),
    ' ',
    time,
  ];
    return datetime.join('');
}

var filterTime = function(value) {
  return value != ':';
}

var createData = function(stringFromCallCenter) {
  var tempData = utf8.encode(stringFromCallCenter).split('');
  var called_at = formatDatetime(tempData.slice(0, 16));
  var internal = tempData.slice(22, 25).join('') * 1;
  var duration = calculateSeconds(tempData.slice(30, 38).join('').split(':'));
  var phone = tempData.slice(38, 52).join('');

  if(phone.substring(0,4) === "1777") {
    phone = phone.substring(4);
  } else {
    phone = phone.substring(0, 10);
  }
  var call_type = tempData.slice(75, 76).join('') * 1;

  var d = {
    phone: phone,
    called_at: called_at,
    duration: duration,
    internal_id: internal,
    call_type_id: call_type
  };
  return d;
};

var sendCallToApi = function(call) {
  var options = {
    host: '172.17.32.200',
    //url: 'http://172.17.32.200',
    path: '/calls',
    method: 'POST',
    headers: {
      "Content-Type": "application/json"
    }
  };
  var req = http.request(options, function(res) {
    var str = '';
    res.setEncoding('utf8');
    res.on('data', function(data) {
      console.log('Response: ' + data);
    });
    res.on('error', function(error) {
      console.log(error);
    });
  });
  req.on('error', function(error) {
    console.log('Error: ' + error);
  });
  req.write(call);
  req.end();
}

var asyncDataReader = function(path) {
  var data = fs.readFile(path, 'utf8');
  return data;
}

var watcher = chokidar.watch('./calls/', {
  ignored: /[\/\\]\./,
  persistent: true
});

watcher.on('add', function(path) {
  fs.readFile(path, function(err, data) {
    if(err) { return console.log(err) };
    var res = sendCallToApi(data);
    fs.unlink(path);
  });
});

port.on('data', function(data){
  if(data.trim() !== ''){
    var call = createData(data);
    var file = folder + "/" + call["called_at"].split(' ').join('').split('-').join('').split(':').join('') + "_" + call["phone"] + '.txt';
    fs.writeFile(file, JSON.stringify(call), function(err) {
      if (err) { return console.log(err); }
      console.log("Call saved in file");  
    });
  }
});
