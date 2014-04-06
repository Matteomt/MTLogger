fs = require('fs');

function MTLogger(log_file_path, log_history_limit, log_load_byte_limit){
	this._already_warned_about_no_file_support = false;
	this._file_path = log_file_path || null;
	this._file_append_stream = null;
	this._logged = [];
	this._prev = undefined;
	
	if(log_history_limit === undefined)
		this._limit = 100;
	else
		this._limit = Math.max(log_history_limit,1);
		
	if(log_load_byte_limit === undefined)
		this._load_size_limit = 5000;
	else
		this._load_size_limit = Math.max(log_load_byte_limit,1);
	
	var that = this;
	
	//Following: read log file and load it into the _logged array.
	if(that._file_path !== null) try{
		fs.stat(that._file_path, function(err, stat){
			if(err)return;
			var file_size = stat.size;
			var start = 0;
			if(that._load_size_limit >= 0 && file_size > that._load_size_limit)
				start = file_size - that._load_size_limit;
			var len = file_size - start;
			fs.open(that._file_path, 'r', function(err,fd){
				if(err)return;
				//NOTE: ^ Let me use file storage only if I can at least read the log file!
				fs.read(fd, new Buffer(len), 0, len, start, function(err, bytesRead, buffer){
					if(err)return;
					var lines = buffer.toString().split('\r\n');
					lines.forEach(function(line, index){
						if(index != 0){//NOTE: ignore the first line (may be incomplete)
							var parsed = null;
							try{
								parsed = JSON.parse(line);
							}catch(e){}
							if(parsed !== null)
								that.pushLogObject(parsed);
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
				});
			});
		});
	}catch(e){}
	
	return this;
}
MTLogger.prototype.pushLogObject = function(log_object){
	//NOTE: The log is limited in the local array, but not in the file.
	while(this._logged.length >= this._limit && this._limit > 0)
		this._logged.shift();
	this._logged.push(log_object);
}
MTLogger.prototype.log = function(level, message){
	try{
		if(message === undefined || level === undefined)
			throw new Error("La mia funzione log richiede due paramentri non undefined");
		var timestamp = Date.now();
		var id = 0;
		if(this._prev !== undefined){
			id = this._prev.id + 1;
			if(id > 9 && timestamp != this._prev.timestamp)
				id = 1;
		}
		var log_object = {
			  timestamp: timestamp,
			  level: level,
			  message: message,
			  id: id
			};
		this._prev = log_object;
		if(this._file_append_stream === null && this._file_path !== null){
			try{
				this._file_append_stream = fs.createWriteStream(this._file_path, {'flags': 'a'});
			}catch(e){
				this._file_append_stream = null;
			}
		}
		if(this._file_append_stream !== null){
			var that = this;
			this._file_append_stream.write( JSON.stringify(log_object)+"\r\n" , function(){
					that.pushLogObject(log_object); //NOTE: logs only after file write completed.
				});
		}else{
			this.pushLogObject(log_object);
			if(!this._already_warned_about_no_file_support){
				this._already_warned_about_no_file_support = true;
				this.log('warn','Logging without file storage support!');
			}
		}
	}catch(e){
		console.log("------------------------------------");
		console.log("Error while trying to log something:");
		console.log("  log object: ", log_object);
		console.log("  exception: ", e);
		console.log("------------------------------------");
	}
};
MTLogger.prototype.silly =   function(message){ this.log('silly',   message); };
MTLogger.prototype.debug =   function(message){ this.log('debug',   message); };
MTLogger.prototype.verbose = function(message){ this.log('verbose', message); };
MTLogger.prototype.info =    function(message){ this.log('info',    message); };
MTLogger.prototype.warn =    function(message){ this.log('warn',    message); };
MTLogger.prototype.error =   function(message){ this.log('error',   message); };

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

module.exports = MTLogger;




/* **** OLD LOGGER
 * 
 * 
ServerState_log = [];
var logger = {
    log: function(level, message){
        if(message === undefined || level === undefined)
            throw new Error("La mia funzione log richiede due paramentri non undefined");
        var log_object = {
              timestamp: Date.now(),
              level: level,
              message: message
            };
        ServerState_log.push(log_object);
        if(ServerState_log.length > 50) //NOTE, the log shown to clients is limited
            ServerState_log.shift();
        var log_line = JSON.stringify(log_object);
        fs.appendFile('server.log', log_line);
    },
    silly:   function(message){ this.log('silly',   message); },
    debug:   function(message){ this.log('debug',   message); },
    verbose: function(message){ this.log('verbose', message); },
    info:    function(message){ this.log('info',    message); },
    warn:    function(message){ this.log('warn',    message); },
    error:   function(message){ this.log('error',   message); }
}

*/
