/**
Makes editable any HTML element on the page. Applied as jQuery method.

@class editable
@uses editableContainer
**/
(function ($) {

    var Editable = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, $.fn.editable.defaults, $.fn.editableutils.getConfigData(this.$element), options);  
        this.init();
    };

    Editable.prototype = {
        constructor: Editable, 
        init: function () {
            var TypeConstructor, 
                isValueByText = false, 
                doAutotext, 
                finalize;

            //editableContainer must be defined
            if(!$.fn.editableContainer) {
                $.error('You must define $.fn.editableContainer via including corresponding file (e.g. editable-popover.js)');
                return;
            }    
                
            //name
            this.options.name = this.options.name || this.$element.attr('id');
             
            //create input of specified type. Input will be used for converting value, not in form
            if(typeof $.fn.editabletypes[this.options.type] === 'function') {
                TypeConstructor = $.fn.editabletypes[this.options.type];
                this.typeOptions = $.fn.editableutils.sliceObj(this.options, $.fn.editableutils.objectKeys(TypeConstructor.defaults));
                this.input = new TypeConstructor(this.typeOptions);
            } else {
                $.error('Unknown type: '+ this.options.type);
                return; 
            }

            // determine if we're knockout powered
            if (window.ko !== undefined && window.ko !== null) { // knockout available
                var koObservableData = this.$element.data('koObservable');
                if (koObservableData !== undefined && koObservableData != null && window.ko.isObservable(koObservableData)) {
                    this.koObservable = koObservableData;
                }
                else if (this.options.koObservable !== undefined && this.options.koObservable !== null && window.ko.isObservable(this.options.koObservable)) {
                    this.koObservable = this.options.koObservable;
                }
            }
            this.isKnockoutPowered = this.koObservable != null;

            //set value from settings or by element's text
            if (this.isKnockoutPowered) {
                this.value = this.input.str2value($.trim(this.koObservable()));

                // subscribe to observable so that inputs can be notified
                var self = this;
                this.koObservable.subscribe(function(newValue) {
                    if (self.value !== newValue) {
                        // send updated value to input
                        self.setValue(newValue, true);
                    }
                });
            } else {
                if (this.options.value === undefined || this.options.value === null) {
                    this.value = this.input.html2value($.trim(this.$element.html()));
                    isValueByText = true;
                } else {
                    /*
                      value can be string when received from 'data-value' attribute
                      for complext objects value can be set as json string in data-value attribute, 
                      e.g. data-value="{city: 'Moscow', street: 'Lenina'}"
                    */
                    this.options.value = $.fn.editableutils.tryParseJson(this.options.value, true); 
                    if(typeof this.options.value === 'string') {
                        this.value = this.input.str2value(this.options.value);
                    } else {
                        this.value = this.options.value;
                    }
                }
            }
            
            
            //add 'editable' class to every editable element
            this.$element.addClass('editable');
            
            //attach handler activating editable. In disabled mode it just prevent default action (useful for links)
            if(this.options.toggle !== 'manual') {
                this.$element.addClass('editable-click');
                this.$element.on(this.options.toggle + '.editable', $.proxy(function(e){
                    e.preventDefault();
                    //stop propagation not required anymore because in document click handler it checks event target
                    //e.stopPropagation();
                    
                    if(this.options.toggle === 'mouseenter') {
                        //for hover only show container
                        this.show(); 
                    } else {
                        //when toggle='click' we should not close all other containers as they will be closed automatically in document click listener
                        var closeAll = (this.options.toggle !== 'click');
                        this.toggle(closeAll);
                    }                    
                }, this));
            } else {
                this.$element.attr('tabindex', -1); //do not stop focus on element when toggled manually
            }
            
            //check conditions for autotext:
            //if value was generated by text or value is empty, no sense to run autotext
            doAutotext = !isValueByText && this.getValue() !== null && this.getValue() !== undefined;
            doAutotext &= (this.options.autotext === 'always') || (this.options.autotext === 'auto' && !this.$element.text().length);
            $.when(doAutotext ? this.render() : true).then($.proxy(function() {
                if(this.options.disabled) {
                    this.disable();
                } else {
                    this.enable(); 
                }
               /**        
               Fired when element was initialized by editable method.
                              
               @event init 
               @param {Object} event event object
               @param {Object} editable editable instance
               @since 1.2.0
               **/                  
                this.$element.triggerHandler('init', this);
            }, this));
        },

        /*
        Renders value into element's text.
        Can call custom display method from options.
        Can return deferred object.
        @method render()
        */          
        render: function() {
            //do not display anything
            if(this.options.display === false) {
                return;
            }
            //if it is input with source, we pass callback in third param to be called when source is loaded
            if(this.input.options.hasOwnProperty('source')) {
                return this.input.value2html(this.value, this.$element[0], this.options.display); 
            //if display method defined --> use it    
            } else if(typeof this.options.display === 'function') {
                return this.options.display.call(this.$element[0], this.value);
            //else use input's original value2html() method    
            } else {
                return this.input.value2html(this.value, this.$element[0]); 
            }
        },
        
        /**
        Enables editable
        @method enable()
        **/          
        enable: function() {
            this.options.disabled = false;
            this.$element.removeClass('editable-disabled');
            this.handleEmpty();
            if(this.options.toggle !== 'manual') {
                if(this.$element.attr('tabindex') === '-1') {    
                    this.$element.removeAttr('tabindex');                                
                }
            }
        },
        
        /**
        Disables editable
        @method disable()
        **/         
        disable: function() {
            this.options.disabled = true; 
            this.hide();           
            this.$element.addClass('editable-disabled');
            this.handleEmpty();
            //do not stop focus on this element
            this.$element.attr('tabindex', -1);                
        },
        
        /**
        Toggles enabled / disabled state of editable element
        @method toggleDisabled()
        **/         
        toggleDisabled: function() {
            if(this.options.disabled) {
                this.enable();
            } else { 
                this.disable(); 
            }
        },  
        
        /**
        Sets new option
        
        @method option(key, value)
        @param {string|object} key option name or object with several options
        @param {mixed} value option new value
        @example
        $('.editable').editable('option', 'pk', 2);
        **/          
        option: function(key, value) {
            //set option(s) by object
            if(key && typeof key === 'object') {
               $.each(key, $.proxy(function(k, v){
                  this.option($.trim(k), v); 
               }, this)); 
               return;
            }

            //set option by string             
            this.options[key] = value;                          
            
            //disabled
            if(key === 'disabled') {
                if(value) {
                    this.disable();
                } else {
                    this.enable();
                }
                return;
            } 
            
            //value
            if(key === 'value') {
                this.setValue(value);
            }
            
            //transfer new option to container! 
            if(this.container) {
                this.container.option(key, value);  
            }
        },              
        
        /*
        * set emptytext if element is empty (reverse: remove emptytext if needed)
        */
        handleEmpty: function () {
            //do not handle empty if we do not display anything
            if(this.options.display === false) {
                return;
            }
            
            var emptyClass = 'editable-empty';
            //emptytext shown only for enabled
            if(!this.options.disabled) {
                if ($.trim(this.$element.text()) === '') {
                    this.$element.addClass(emptyClass).text(this.options.emptytext);
                } else {
                    this.$element.removeClass(emptyClass);
                }
            } else {
                //below required if element disable property was changed
                if(this.$element.hasClass(emptyClass)) {
                    this.$element.empty();
                    this.$element.removeClass(emptyClass);
                }
            }
        },        
        
        /**
        Shows container with form
        @method show()
        @param {boolean} closeAll Whether to close all other editable containers when showing this one. Default true.
        **/  
        show: function (closeAll) {
            if(this.options.disabled) {
                return;
            }
            
            //init editableContainer: popover, tooltip, inline, etc..
            if(!this.container) {
                var containerOptions = $.extend({}, this.options, {
                    value: this.getValue(),
                    koObservable: this.koObservable,
                });
                this.$element.editableContainer(containerOptions);
                this.$element.on("save.internal", $.proxy(this.save, this));
                this.container = this.$element.data('editableContainer'); 
            } else if(this.container.tip().is(':visible')) {
                return;
            }      
            
            //show container
            this.container.show(closeAll);
        },
        
        /**
        Hides container with form
        @method hide()
        **/       
        hide: function () {   
            if(this.container) {  
                this.container.hide();
            }
        },
        
        /**
        Toggles container visibility (show / hide)
        @method toggle()
        @param {boolean} closeAll Whether to close all other editable containers when showing this one. Default true.
        **/  
        toggle: function(closeAll) {
            if(this.container && this.container.tip().is(':visible')) {
                this.hide();
            } else {
                this.show(closeAll);
            }
        },
        
        /*
        * called when form was submitted
        */          
        save: function(e, params) {
            //if url is not user's function and value was not sent to server and value changed --> mark element with unsaved css. 
            if(typeof this.options.url !== 'function' && this.options.display !== false && params.response === undefined && this.input.value2str(this.getValue()) !== this.input.value2str(params.newValue)) { 
                this.$element.addClass('editable-unsaved');
            } else {
                this.$element.removeClass('editable-unsaved');
            }
            
           // this.hide();
            this.setValue(params.newValue);
            
            /**        
            Fired when new value was submitted. You can use <code>$(this).data('editable')</code> to access to editable instance
            
            @event save 
            @param {Object} event event object
            @param {Object} params additional params
            @param {mixed} params.newValue submitted value
            @param {Object} params.response ajax response
            @example
            $('#username').on('save', function(e, params) {
                //assuming server response: '{success: true}'
                var pk = $(this).data('editable').options.pk;
                if(params.response && params.response.success) {
                    alert('value: ' + params.newValue + ' with pk: ' + pk + ' saved!');
                } else {
                    alert('error!'); 
                } 
            });
            **/
            //event itself is triggered by editableContainer. Description here is only for documentation              
        },

        validate: function () {
            if (typeof this.options.validate === 'function') {
                return this.options.validate.call(this, this.getValue());
            }
        },
        
        /**
        Gets current value of editable.  Use this instead of this.value so that view model values can be supported.
        @method getValue()
        **/
        getValue: function() {
            return this.isKnockoutPowered ? this.koObservable() : this.value;
        },

        /**
        Sets new value of editable
        @method setValue(value, convertStr)
        @param {mixed} value new value 
        @param {boolean} convertStr whether to convert value from string to internal format
        **/         
        setValue: function(value, convertStr) {
            var newValue;

            if(convertStr) {
                newValue = this.input.str2value(value);
            } else {
                newValue = value;
            }

            if (this.isKnockoutPowered) {
                this.value = newValue;
                this.koObservable(newValue);
            } else {
                this.value = newValue;
            }

            if(this.container) {
                this.container.option('value', newValue);
            }
            $.when(this.render())
            .then($.proxy(function() {
                this.handleEmpty();
            }, this));
        },
        
        /**
        Activates input of visible container (e.g. set focus)
        @method activate()
        **/         
        activate: function() {
            if(this.container) {
               this.container.activate(); 
            }
        }
    };

    /* EDITABLE PLUGIN DEFINITION
    * ======================= */

    /**
    jQuery method to initialize editable element.
    
    @method $().editable(options)
    @params {Object} options
    @example
    $('#username').editable({
        type: 'text',
        url: '/post',
        pk: 1
    });
    **/    
    $.fn.editable = function (option) {
        //special API methods returning non-jquery object
        var result = {}, args = arguments, datakey = 'editable';
        switch (option) {
            /**
            Runs client-side validation for all matched editables
            
            @method validate()
            @returns {Object} validation errors map
            @example
            $('#username, #fullname').editable('validate');
            // possible result:
            {
              username: "username is required",
              fullname: "fullname should be minimum 3 letters length"
            }
            **/             
            case 'validate':
                this.each(function () {
                    var $this = $(this), data = $this.data(datakey), error;
                    if (data && (error = data.validate())) {
                        result[data.options.name] = error;
                    }
                });
            return result;

            /**
            Returns current values of editable elements. If value is <code>null</code> or <code>undefined</code> it will not be returned
            @method getValue()
            @returns {Object} object of element names and values
            @example
            $('#username, #fullname').editable('validate');
            // possible result:
            {
            username: "superuser",
            fullname: "John"
            }
            **/               
            case 'getValue':
                this.each(function () {
                    var $this = $(this), data = $this.data(datakey);
                    if (data && data.value !== undefined && data.value !== null) {
                        result[data.options.name] = data.input.value2submit(data.value);
                    }
                });
            return result;

            /**  
            This method collects values from several editable elements and submit them all to server.   
            Internally it runs client-side validation for all fields and submits only in case of success.  
            See <a href="#newrecord">creating new records</a> for details.
            
            @method submit(options)
            @param {object} options 
            @param {object} options.url url to submit data 
            @param {object} options.data additional data to submit
            @param {object} options.ajaxOptions additional ajax options            
            @param {function} options.error(obj) error handler 
            @param {function} options.success(obj,config) success handler
            @returns {Object} jQuery object
            **/            
            case 'submit':  //collects value, validate and submit to server for creating new record
                var config = arguments[1] || {},
                $elems = this,
                errors = this.editable('validate'),
                values;

                if($.isEmptyObject(errors)) {
                    values = this.editable('getValue'); 
                    if(config.data) {
                        $.extend(values, config.data);
                    }                    
                    
                    $.ajax($.extend({
                        url: config.url, 
                        data: values, 
                        type: 'POST'                        
                    }, config.ajaxOptions))
                    .success(function(response) {
                        //successful response 200 OK
                        if(typeof config.success === 'function') {
                            config.success.call($elems, response, config);
                        } 
                    })
                    .error(function(){  //ajax error
                        if(typeof config.error === 'function') {
                            config.error.apply($elems, arguments);
                        }
                    });
                } else { //client-side validation error
                    if(typeof config.error === 'function') {
                        config.error.call($elems, errors);
                    }
                }
            return this;
        }

        //return jquery object
        return this.each(function () {
            var $this = $(this), 
                data = $this.data(datakey), 
                options = typeof option === 'object' && option;

            if (!data) {
                $this.data(datakey, (data = new Editable(this, options)));
            }

            if (typeof option === 'string') { //call method 
                data[option].apply(data, Array.prototype.slice.call(args, 1));
            } 
        });
    };    
            

    $.fn.editable.defaults = {
        /**
        Type of input. Can be <code>text|textarea|select|date|checklist</code> and more

        @property type 
        @type string
        @default 'text'
        **/
        type: 'text',        
        /**
        Sets disabled state of editable

        @property disabled 
        @type boolean
        @default false
        **/         
        disabled: false,
        /**
        How to toggle editable. Can be <code>click|dblclick|mouseenter|manual</code>.   
        When set to <code>manual</code> you should manually call <code>show/hide</code> methods of editable.    
        **Note**: if you call <code>show</code> or <code>toggle</code> inside **click** handler of some DOM element, 
        you need to apply <code>e.stopPropagation()</code> because containers are being closed on any click on document.
        
        @example
        $('#edit-button').click(function(e) {
            e.stopPropagation();
            $('#username').editable('toggle');
        });

        @property toggle 
        @type string
        @default 'click'
        **/          
        toggle: 'click',
        /**
        Text shown when element is empty.

        @property emptytext 
        @type string
        @default 'Empty'
        **/         
        emptytext: 'Empty',
        /**
        Allows to automatically set element's text based on it's value. Can be <code>auto|always|never</code>. Useful for select and date.
        For example, if dropdown list is <code>{1: 'a', 2: 'b'}</code> and element's value set to <code>1</code>, it's html will be automatically set to <code>'a'</code>.  
        <code>auto</code> - text will be automatically set only if element is empty.  
        <code>always|never</code> - always(never) try to set element's text.

        @property autotext 
        @type string
        @default 'auto'
        **/          
        autotext: 'auto', 
        /**
        Initial value of input. Taken from <code>data-value</code> or element's text.

        @property value 
        @type mixed
        @default element's text
        **/
        value: null,

        /**
         Observable object that stores the value of input (both initial and continuously updated, see Knockout's MVVM approach)

         @property koObservable
         @type Observable (from Knockout.js library)
         @default null
         **/
        koObservable: null,
	
        /**
        Callback to perform custom displaying of value in element's text.  
        If <code>null</code>, default input's value2html() will be called.  
        If <code>false</code>, no displaying methods will be called, element's text will no change.  
        Runs under element's scope.  
        Second parameter __sourceData__ is passed for inputs with source (select, checklist).
        
        @property display 
        @type function|boolean
        @default null
        @since 1.2.0
        @example
        display: function(value, sourceData) {
            var escapedValue = $('<div>').text(value).html();
            $(this).html('<b>'+escapedValue+'</b>');
        }
        **/          
        display: null
    };
    
    // if knockout is available, set up the custom binding for koObservable
    if (typeof window.ko !== 'undefined' && window.ko !== null &&
            typeof window.ko.bindingHandlers !== 'undefined' && window.ko.bindingHandlers !== null &&
            typeof window.ko.bindingHandlers.koObservable === 'undefined') {
        window.ko.bindingHandlers.koObservable = {
            init: function (domElement, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
                return $(domElement).data('koObservable', valueAccessor());
            }
        };
    }

}(window.jQuery));
