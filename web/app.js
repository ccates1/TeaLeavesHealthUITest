(function () {
    "use strict";

    var app = angular.module('tealeaveshealth', ['ui.router', 'ui.bootstrap', 'ngSanitize', 'ngAnimate', 'schemaForm', 'ngTable'])

    app.constant('_', window._);

    // app.config(['$qProvider', function ($qProvider) {
    //     $qProvider.errorOnUnhandledRejections(false);
    // }]);

    app.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {

        $stateProvider
            .state('home', {
                url: '/',
                templateUrl: 'templates/home.html',
                controller: 'HomeCtrl'
            })
            .state('employees', {
                url: '/employees',
                templateUrl: '/employees.html',
                controller: 'HomeCtrl'
            })
            .state('organizations', {
                url: '/organizations',
                templateUrl: '/organizations.html',
                controller: 'HomeCtrl'
            })
        $urlRouterProvider.otherwise('/');
    }]);

    app.controller('HomeCtrl', ['$scope', '$uibModal', '$q', 'NgTableParams', 'Organization','Employee', function ($scope, $uibModal, $q, NgTableParams, Organization, Employee) {

        $scope.employees  = [];
        $scope.organizations = [];

        var EntityClasses =$scope.EntityClasses = {Employee: Employee, Organization: Organization}

        $scope.$on('newEntityCreated', function (event, data) {

            var entity = data.entity || {}
            var entityTypeName = entity._type

            if (entityTypeName === "Employee") {

                $scope.employees.push(entity)
            } else {
                $scope.organizations.push(entity)
            }

            updateNgTables();
        })

        function init () {
            debugger
            var schemas = {}
            var promises = []

            _.each(EntityClasses, function (entityClass) {
                var schemaDef = entityClass.getSchemaDefs()
                var entityTypeName = entityClass._type
                schemas[entityTypeName] = schemaDef
                promises.push(entityClass.getAll())
            })

            $scope.schemas = schemas;

            $scope.defaultForm = ['*']

            $q.all(promises).then(function (res) {

                var employeeRes = res[0].data || []
                var organizationRes = res[1].data || []

                // employeeRes = _.map(employeeRes, function (employee) {
                //     var totalOrganizations = employee.organizations || []
                //     employee.totalOrganizations = totalOrganizations.length
                //     return employee;
                // })

                configureNgTables(employeeRes, organizationRes)
            }, function (err) {
                console.error(err);
            })
        }

        function configureNgTables (employeeData, organizationData, isUpdate) {

            $scope.employees = employeeData;
            $scope.organizations = organizationData;

            $scope.EmployeeTableData = new NgTableParams({count: 5}, {counts: [5, 10, 20], dataset: employeeData})
            $scope.OrganizationTableData = new NgTableParams({count: 5}, {counts: [5, 10, 20], dataset: organizationData})
        }

        function updateNgTables () {
            $scope.EmployeeTableData.reload();
            $scope.OrganizationTableData.reload();
        }

        $scope.promptEntityEditorModal = function (entityTypeName, entity) {
            debugger

            var $newScope = $scope.$new();

            var EntityClass = $newScope.EntityClass = EntityClasses[entityTypeName]

            $newScope.entityTypeName = EntityClass._type;

            if (entity && entity._id) {
                $newScope.entity = entity

            }

            var options = {
                animation: true,
                templateUrl: '/entityEditorModal.html',
                controller: 'BaseModalCtrl',
                size: 'lg',
                scope: $newScope
            }


            var modalInstance = $uibModal.open(options);

            modalInstance.result.then(function () {
            }, function () {
                $newScope.$destroy()
            })
        };

        $scope.getFullNameForUser = function (user) {

            if (user) {
                return user.firstName + " " + user.lastName;
            }
        };

        $scope.deleteInstanceById = function (entity, $index) {

            var entityTypeName = entity._type;

            var EntityClass = $scope.EntityClasses[entityTypeName]

            EntityClass.deleteInstanceById(entity._id).then(function (res) {

                if (entityTypeName === "Employee") {
                    $scope.employees.splice($index, 1)
                } else {
                    $scope.organizations.splice($index, 1)
                }

                updateNgTables();

            }, function (err) {
                console.error(err);
            })
        }
        init()
    }]);

    app.controller('BaseModalCtrl', ['$scope', '$uibModalInstance', 'Organization', function ($scope, $uibModalInstance, Organization) {

        var entity = $scope.entity  = $scope.entity || {}

        var EntityClass = $scope.EntityClass;

        var entityTypeName = $scope.enittyTypeName || EntityClass._type;

        if (entityTypeName === "Employee") {
            Organization.getAll().then(function (res) {

                var availableOrganizations = res.data || []

                if (entity._id) {
                    // edit mode
                    var relatedOrganizations = entity.organizations || []

                    if (relatedOrganizations.length) {
                        _.each(availableOrganizations, function (opt) {

                            var checkExists = _.findIndex(relatedOrganizations, {_id: opt._id});

                            if (checkExists > -1) {
                                availableOrganizations[checkExists].isChecked = true;
                            }
                        })
                    }

                }

                $scope.availableOrganizations = availableOrganizations
            }, function (err) {
                console.error(err);
            })
        }

        $scope.closeModal = function () {
            $uibModalInstance.dismiss('cancel');
        }

        $scope.updateEmployeeOrganizations = function (org) {
            var entity = $scope.entity;
            entity.organizations = entity.organizations || []
            entity.organizations.push(org)
        }

        $scope.$on('$destroy', function() {
            $scope.closeModal()
        });


        $scope.handleEntityFormSubmission = function (form, entity) {
            debugger
            entity = entity || $scope.entity

            entity._type =entityTypeName

            $scope.$broadcast('schemaFormValidate');

            if (!form.$valid) {
                return;
            } else {
               if (entity._id) {

                   if (entityTypeName === "Employee") {
                       var entityOrgs = _.filter($scope.availableOrganizations, {isChecked: true})


                       entity.organizations = entityOrgs;
                   }

                   EntityClass.updateInstanceById(entity._id, entity).then(function (res) {

                       $scope.closeModal()
                   }, function (err) {
                       console.error(err);
                   })
               } else {

                   var addedOrgs = entity.organizations || []

                   EntityClass.createNewInstance(entity).then(function (res) {

                       var newEntity = res.data
                       if (addedOrgs.length) {
                           newEntity.organizations = addedOrgs
                       }

                       $scope.closeModal()
                       $scope.$emit('newEntityCreated', {entity: newEntity})
                   }, function (err) {
                       console.error(err);
                   })
               }
            }
        }
    }])

    app.filter('printArrayOrgNames', ['_', function (_) {
        return function (array) {
            if (array) {
                var resultarray = _.pluck(array, 'name')
                return resultarray.join(", ");
            }
        }
    }])

    app.filter('displayDate', ['_', function (_) {
        return function (val) {
            if(!_.isUndefined(val))
            {
                return moment(val).format('MMMM Do YYYY');
            }
        }
    }])


    app.factory('Employee', ['$http', function ($http) {
        var Employee = {_type: 'Employee'};
        Employee.getSchemaDefs = function () {
            return {
                type: 'object',
                properties: {
                    firstName: {
                        title: 'First Name',
                        type: 'string'
                    },
                    lastName: {
                        title: 'Last Name',
                        type: 'string'
                    },
                },
                required: ['firstName', 'lastName', 'organizations']
            }
        }
        Employee.createNewInstance = function (data) {
            return $http.post('/employee', data);
        }
        Employee.getAll = function () {
            return $http.get('/employees');
        }
        Employee.getOne = function (id) {
            return $http.get('/employees/' + id);
        }
        Employee.updateInstanceById = function (id, updateData) {
            return $http.put('/employees/' + id, updateData);
        }
        Employee.deleteInstanceById = function (id) {
            return $http.delete('/employees/' + id );
        }
        return Employee
    }])

    app.factory('Organization', ['$http', function ($http) {
        var Organization = {_type: 'Organization'};
        Organization.getSchemaDefs = function () {
            return {
                type: 'object',
                properties: {
                    name: {
                        title: 'Name',
                        type: 'string'
                    },
                    location: {
                        title: 'Location',
                        type: 'string'
                    }
                },    required: ['name', 'location']
            }
        }
        Organization.createNewInstance = function (data) {
            return $http.post('/organization', data);
        }
        Organization.getAll = function () {
            return $http.get('/organizations');
        }
        Organization.getOne = function (id) {
            return $http.get('/organizations/' + id);
        }
        Organization.updateInstanceById = function (id, updateData) {
            return $http.put('/organizations/' + id, updateData);
        }
        Organization.deleteInstanceById = function (id) {
            return $http.delete('/organizations/' + id );
        }
        return Organization
    }])

})();