var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var fs = require('fs');
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
  //var tempData = utf8.encode(stringFromCallCenter);
  var tempData = stringFromCallCenter.split('');
  //var called_at = formatDatetime(tempData.substring(0, 16));
  var called_at = formatDatetime(tempData.slice(0, 16));
  //var internal = tempData.substring(23, 3); 
  var internal = tempData.slice(22, 25).join('') * 1;
  //var duration = calculateSeconds(tempData.substring(30, 8).split(':'));
  var duration = calculateSeconds(tempData.slice(30, 38).filter(filterTime));
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

// var newCall = createData("13.05.1615:34:49  7   160     00:04:3217776944244414                     8 2                          9 6        ");

var sendCallToApi = function(call) {
  var options = {
    host: '172.17.32.200',
    //url: 'http://172.17.32.200',
    path: '/calls',
    method: 'POST',
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(JSON.stringify(call))
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
  req.write("call:{" + JSON.stringify(call) + "}");
  req.end();
}

var asyncDataReader = function(path) {
  var data = fs.readFileSync(path, 'utf8');
  return data;
}

setInterval(function() {
  fs.readdir(folder, function(err, files) {
    if(err) { return console.log(err); }
    files.forEach(function(file) {
      file = "./calls/" + file;
      var recoveredCall = asyncDataReader(file);
      console.log(recoveredCall);
      if (recoveredCall) {
        var resp = sendCallToApi(recoveredCall);
	console.log(resp);
        fs.unlinkSync(file);
      }
    });
  });
}, 1000);

var fileName = function() {
  var date = new Date();
  return "./" + folder + "/" + date.getYear() + date.getMonth() + date.getDay() + date.getHours() + date.getMinutes + date.getSeconds();
}

port.on('data', function(data){
  if(data.trim() !== ''){
    var call = createData(data);
    console.log(call);
    var file = folder + "/" + call["called_at"].split(' ').join('').split('-').join('').split(':').join('') + "_" + call["phone"] + '.txt';
    console.log(file);
    fs.writeFile(file, JSON.stringify(call), function(err) {
      if (err) { return console.log(err); }
      console.log("Call saved in file");  
    });
  }
});
