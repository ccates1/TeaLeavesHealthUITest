var mongoose = require('mongoose'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    morgan = require('morgan'),
    path = require('path'),
    _ = require('lodash'),
    Promise = require('bluebird'),
    appConfig = require('./config.js');


var app = express();
app.set('port', process.env.PORT || 3198);
app.use(cors({
    origin: '*',
    withCredentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(express.static(path.join(__dirname, 'web')));

mongoose.Promise = global.Promise;
mongoose.connect(appConfig.url);
mongoose.connection.on('error', function (err) {
    console.log('Error: Could not connect to MongoDB.');
});

var organizationSchema = new mongoose.Schema({
    name: String,
    _type: String,
    location: String,
    employees: Number
});
var Organization = mongoose.model('Organization', organizationSchema);

organizationSchema.pre('save', function (next) {

    var self = this;

    var isNewInstance = self.isNew || false;

    if (isNewInstance) {
        self.created = new Date()

        self.employees = self.employees || 0;
    }

    next();
})

var employeeSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    _type: String,
    organizations: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization'
        }
    ],
    created: Date
});
var Employee = mongoose.model('Employee', employeeSchema);

employeeSchema.pre('save', function (next) {

    var self = this;

    var isNewInstance = self.isNew || false;

    if (isNewInstance) {
        self.created = new Date()
    }

    next();
    // if (self.organizations) {
    //
    //     var id = self._id;
    //
    //     checkIfUpdateNeededForOrganizations(id, function (err, res) {
    //
    //         next();
    //     })
    // } else {
    //     next();
    // }
})

// function checkIfUpdateNeededForOrganizations (employeeId) {
//     Employee.findById(employeeId).populate('organizations').exec(function (err, res) {
//
//
//     })
// }

app.put('/employees/:employeeId', function (req, res, next) {
    var updateData = req.body;

    updateData.created = new Date(updateData.created)

    var updatedOrgs= updateData.organizations || []

    var updateProms = []

    var query = Employee.findById(req.params.employeeId)

    query.exec(function (err, result) {
        if (err) {
            return next(err);
        }


        result.organizations = updatedOrgs;

        updateProms.push(result.save());

        updateProms.push(Employee.update({_id: req.params.employeeId}, updateData))

        // updateProms.push(result.save())
        //
        Promise.all(updateProms).then(function (result) {
            Employee.update({_id: req.params.employeeId}, updateData, function (err, result) {
                if (err)  return next(err);

                return res.send(result);
            })
        })

    })
})

app.post('/employee', function (req, res, next) {
    var newEntity = req.body;

    var employee = new Employee(newEntity);

    var promises = [];

    Promise.all(promises).then(function (result) {
        employee.created = new Date();

        employee.save(function (err, data) {
            if (err) return next(err)

            return res.send(data)
        })
    })


});

app.get('/employees', function (req, res, next) {

    Employee.find({}, function (err, data) {
        Employee.populate(data, {path: 'organizations'})
            .then(function (data) {
                res.json(data);
            })
            .catch(function (err) {
                throw(err)
            });
    });
});
app.get('/employees/:employeeId', function (req, res, next) {

    Employee.findOne({_id: req.params.employeeId}, function (err, data) {
        Employee.populate(data, {path: 'organizations'})
            .then(function (data) {
                res.json(data);
            })
            .catch(function (err) {
                throw(err)
            });
    });
});
app.post('/organization', function (req, res, next) {

    var organization = new Organization(req.body);

    organization.save(function (err, data) {
        if (err) throw err;

        return res.send(data);
    })
});
app.delete('/employees/:employeeId', function (req, res, next) {

    Employee.findByIdAndRemove(req.params.employeeId, function (err, result) {
        if (err) throw err;

        return res.send({res: result});
    })

})
app.delete('/organizations/:organizationId', function (req, res, next) {

    Organization.findByIdAndRemove(req.params.organizationId, function (err, result) {
        if (err) throw err;

        return res.send({res: result});
    })

})
app.get('/organizations/:organizationId', function (req, res, next) {

    Organization.findOne({_id: req.params.employeeId}, function (err, data) {
        Organization.populate(data, {path: 'employees'})
            .then(function (data) {
                res.json(data);
            })
            .catch(function (err) {
                throw(err)
            });
    });
});
app.get('/organizations', function (req, res, next) {

    Organization.find({}, function (err, data) {
        if (err) throw err;

        res.send(data);
    });
});
app.put('/organizations/:organizationId', function (req, res, next) {
    var updateData = req.body;

    delete updateData._id;

    Organization.update({_id: req.params.organizationId}, updateData, {}, function (err, result) {
        if (err) {
            return next(err);
        }
        res.send(result);
    })
})

app.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});