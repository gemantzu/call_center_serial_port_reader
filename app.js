var serialport = require('serialport');
var SerialPort = serialport.SerialPort;
var fs = require('fs');
var utf8 = require('utf8');
var http = require('http');
var folder = 'calls';

var port = new SerialPort('\\\\.\\COM1', { 
  baudrate: 9600,
  parser: serialport.parsers.raw
}, true);

var calculateSeconds = function(arrayOfTime) {
  var hours = arrayOfTime[0] * 1;
  var minutes = arrayOfTime[1] * 1;
  var seconds = arrayOfTime[2] * 1;
  return (hours * 3600) + (minutes * 60) + seconds;
};

var formatDatetime = function(dateFromCallCenter) {
  var date = dateFromCallCenter.substring(0, 8).split('.');
  var time = dateFromCallCenter.substring(8);
  var datetime = [
    '20',
    date[2],
    '-',
    date[1],
    '-',
    date[0],
    ' ',
    time,
  ];
    return datetime.join('');
}

var createData = function(stringFromCallCenter) {
  var tempData = utf8.encode(stringFromCallCenter);
  var tempArray = tempData.split(" ");
  var tempArray = tempArray.filter(function(e){ return e.replace(/(\r\n|\n|\r)/gm,"")});

  var called_at = formatDatetime(tempArray[0]);
  var internal = tempArray[2] * 1;
  var durationAndNumber = tempArray[3];
  var duration = calculateSeconds(durationAndNumber.substring(0, 8).split(':'));
  var phone = durationAndNumber.substring(8); 

  if(phone.substring(0,4) === "1777") {
    phone = phone.substring(4)
  }
  var call_type = tempArray[5] * 1;

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
    host: 'localhost',
    url: 'http://localhost',
    port: '3000',
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
  req.write(JSON.stringify(call));
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
  // var call = createData(data);
  // var file = folder + "/" + call["called_at"].split(' ').join('').split('-').join('').split(':').join('') + "_" + call["phone"] + '.txt';
  var file = fileName();
  fs.writeFile(file, data, function(err) {
    if (err) { return console.log(err); }
    console.log("Call saved in file");  
  });
});
