fs = require('fs');

function MTLogger(file_path, history_limit, load_limit){
  this._logged = [];
  this._prev = undefined;
  this._loading_file = false;
  this._loading_file_queue = [];
  
  this.limit(typeof history_limit == 'number' ? history_limit : 100);
  
  this.file(file_path, true, load_limit);
  
  return this;
}

MTLogger.prototype.file = function(file_path, load_limit, callback){
  if(file_path === undefined && load_limit === undefined && callback === undefined){
    return this._file_path;
  }
  this._use_file = (typeof file_path == 'string');
  this._warn_if_no_file = this._use_file;
  this._file_path = (this._use_file ? file_path : null);
  
  load_limit = (typeof load_limit == 'number' ? Math.max(load_limit,0) : 5000);
  if(typeof callback != 'function')
    callback = function(err,count){if(err)throw err;};
  
  if(!this._use_file || load_limit < 2){
    callback(null,0);
    return this;
  }
  
  //if(this._loading_file){
  //  callback(new Error("Already loading a file..."), 0);
  //  return this;
  //}
    
  var that = this;
  
  try{
    this._loading_file = true;
    fs.stat(that._file_path, function(err, stat){
      if(err){
        that._loading_file = false;
        callback(err,0);
        return;
      }
      var file_size = stat.size;
      var start = 0;
      if(load_limit > 0 && file_size > load_limit)
        start = file_size - load_limit;
      var len = file_size - start;
      fs.open(that._file_path, 'r', function(err,fd){
        if(err){
          that._loading_file = false;
          callback(err,0);
          return;
        }
        fs.read(fd, new Buffer(len), 0, len, start, function(err, bytesRead, buffer){
          if(err){
            that._loading_file = false;
            callback(err,0);
            return;
          }
          var lines = buffer.toString().split('\r\n');
          var count = 0;
          that._logged = [];
          lines.forEach(function(line, index){
            if(index != 0){//NOTE: ignore the first line (may be incomplete)
              var parsed = null;
              try{
                parsed = JSON.parse(line);
              }catch(e){}
              if(parsed !== null){
                that.pushLogObject(parsed);
                count++;
              }
            }
          });
          that._logged.sort(function(a,b){
            if(a.timestamp < b.timestamp || (a.timestamp == b.timestamp && a.id < b.id))
              return -1;
            if(a.timestamp > b.timestamp || (a.timestamp == b.timestamp && a.id > b.id))
              return 1;
            return 0;
          });
          //NOTE: keep the file blocked until the log is sorted.
          fs.close(fd);
          that._loading_file = false;
          this._prev = that._logged[that._logged.length-1];
          while(that._loading_file_queue.length > 0){
            that.log(that._loading_file_queue.shift());
          }
          callback(null,count);
        });
      });
    });
  }catch(e){
    that._loading_file = false;
    callback(e, 0);
  }
  return this;
}

MTLogger.prototype.limit = function(new_hist_limit){
	if(typeof new_hist_limit == 'number'){
    this._limit = Math.max(new_hist_limit,1);
    if(this._logged.length - this._limit > 10 && this._limit > 0)
      this._logged = this._logged.splice(this._logged.length - this._limit);
    else{
      while(this._logged.length >= this._limit && this._limit > 0)
        this._logged.shift();
    }
  }
	return this._limit;
}

MTLogger.prototype.count = function(){ return this._logged.length+this._loading_file_queue.length; }

MTLogger.prototype.pushLogObject = function(log_object){
  //NOTE: The log is limited in the local array, but not in the file.
  while(this._logged.length >= this._limit && this._limit > 0)
    this._logged.shift();
  this._logged.push(log_object);
}

MTLogger.prototype.log = function(level, message){
  try{
    var log_object;
    if(level === undefined)
      throw new Error("MTLogger.log requires 2 string parameters or 1 object");
    
    if(message !== undefined){
      var timestamp = Date.now();
      var id = 0;
      if(this._prev !== undefined){
        id = this._prev.id + 1;
        if(id > 8 && timestamp != this._prev.timestamp)
          id = 1;
      }
      log_object = {
        timestamp: timestamp,
        level: level,
        message: message,
        id: id
      };
    }else if(typeof level == 'object'){
      log_object = level;
    }else
      throw new Error("MTLogger.log requires 2 string parameters or 1 object");
      
    this._prev = log_object;
    if(this._loading_file){
      this._loading_file_queue.push(log_object);
      return this._loading_file_queue.length;
    }else{
      if(this._use_file && this._file_append_stream == null){
        try{
          this._file_append_stream = fs.createWriteStream(this._file_path, {'flags': 'a'});
        }catch(e){
          this._file_append_stream = null;
        }
      }
      if(this._use_file && this._file_append_stream != null){
        var that = this;
        this._file_append_stream.write( JSON.stringify(log_object)+"\r\n" , function(){
            that.pushLogObject(log_object); //NOTE: logs only after file write completed.
          });
      }else{
        this.pushLogObject(log_object);
        if(this._use_file && this._warn_if_no_file){
          this._warn_if_no_file = false;
          this.log('warn','Logging without file storage support!');
        }
      }
      return this._loading_file_queue.length;
    }
  }catch(e){
    console.log("------------------------------------");
    console.log("Error while trying to log something:");
    console.log("  log object: ", log_object);
    console.log("  exception: ", e);
    console.log("------------------------------------");
  }
  return undefined;
};

MTLogger.prototype.silly =   function(message){ return this.log('silly',   message); };
MTLogger.prototype.debug =   function(message){ return this.log('debug',   message); };
MTLogger.prototype.verbose = function(message){ return this.log('verbose', message); };
MTLogger.prototype.info =    function(message){ return this.log('info',    message); };
MTLogger.prototype.warn =    function(message){ return this.log('warn',    message); };
MTLogger.prototype.error =   function(message){ return this.log('error',   message); };

MTLogger.prototype.all = function(){
  return this._logged;
}

MTLogger.prototype.newest = function(older){
  if(older === undefined || older < 0)
    older = 0;
  return this._logged[this._logged.length - 1 - older];
}

MTLogger.prototype.oldest = function(newer){
  if(newer === undefined || newer < 0)
    newer = 0;
  return this._logged[newer];
}

MTLogger.prototype.newerThen = function(older){
  var oldest = this.oldest();
  if(older==undefined || older.timestamp < oldest.timestamp || (older.timestamp == oldest.timestamp && older.id < oldest.id))
    return this.all();
  var nlog = [];
  var back=0;
  var newer = this.newest(back);
  while(newer.timestamp > older.timestamp || (newer.timestamp == older.timestamp && newer.id > older.id)){
    nlog.unshift(newer);
    back++;
    newer = this.newest(back);
  }
  return nlog;
}

MTLogger.prototype.filtered = function(filter_callback){
	this._logged.filter(filter_callback);
}

module.exports.MTLogger = MTLogger;
module.exports.setup = function(file_path, history_limit, load_limit){
  if(typeof file_path == 'object'){
    options = file_path;
    file_path = (typeof options.load == 'string' ? options.load : undefined) || options.file_path || options.path || options.file;
    history_limit = options.history_limit || options.history || options.hist || options.limit;
    load_limit = (typeof options.load == 'number' ? options.load : undefined) || options.size || options.load_limit;
  }
  return new MTLogger(file_path, history_limit, load_limit);
}
