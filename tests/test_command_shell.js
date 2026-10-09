'use strict';
require('./lib/command-shell').run().then(code=>{process.exitCode=code;}).catch(e=>{console.error(e);process.exitCode=1;});
