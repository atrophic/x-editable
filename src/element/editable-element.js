/**
Makes editable any HTML element on the page. Applied as jQuery method.

@class editable
@uses editableContainer
**/
(function ($) {

    var Editable = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, $.fn.editable.defaults, $.fn.editableform.utils.getConfigData(this.$element), options);  
        this.init();
    };

    Editable.prototype = {
        constructor: Editable, 
        init: function () {
            var TypeConstructor, 
                isValueByText = false, 
                doAutotext, 
                finalize;

            //initialization flag    
            this.isInit = true;    
                
            //editableContainer must be defined
            if(!$.fn.editableContainer) {
                $.error('You must define $.fn.editableContainer via including corresponding file (e.g. editable-popover.js)');
                return;
            }    
                
            //name
            this.options.name = this.options.name || this.$element.attr('id');
             
            //create input of specified type. Input will be used for converting value, not in form
            if(typeof $.fn.editableform.types[this.options.type] === 'function') {
                TypeConstructor = $.fn.editableform.types[this.options.type];
                this.typeOptions = $.fn.editableform.utils.sliceObj(this.options, $.fn.editableform.utils.objectKeys(TypeConstructor.defaults));
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

            if (!this.isKnockoutPowered) {
                //set value from settings or by element's text
                if (this.options.value === undefined || this.options.value === null) {
                    this.value = this.input.html2value($.trim(this.$element.html()));
                    isValueByText = true;
                } else {
                    this.value = this.input.str2value($.trim(this.options.value));
                }
            }

            //attach handler to close any container on escape
            $(document).off('keyup.editable').on('keyup.editable', function (e) {
                if (e.which === 27) {
                    $('.editable-container').find('.editable-cancel').click();
                }
            }); 
            
            //attach handler to close container when click outside
            $(document).off('click.editable').on('click.editable', function(e) {
                var $target = $(e.target);
                //if click inside container --> do nothing
                if($target.is('.editable-container') || $target.parents('.editable-container').length || $target.parents('.ui-datepicker-header').length) {
                    return;
                }
                //close all other containers
                $('.editable-container').find('.editable-cancel').click();
            });
            
            //add 'editable' class
            this.$element.addClass('editable');
            
            //attach click handler. In disabled mode it just prevent default action (useful for links)
            if(this.options.toggle === 'click') {
                this.$element.addClass('editable-click');
                this.$element.on('click.editable', $.proxy(this.click, this));
            } else {
                this.$element.attr('tabindex', -1); //do not stop focus on element when toggled manually
            }
            
            //check conditions for autotext:
            //if value was generated by text or value is empty, no sense to run autotext
            doAutotext = !isValueByText && this.value !== null && this.value !== undefined;
            doAutotext &= (this.options.autotext === 'always') || (this.options.autotext === 'auto' && !this.$element.text().length);
            $.when(doAutotext ? this.input.value2html(this.value, this.$element) : true).then($.proxy(function() {
                if(this.options.disabled) {
                    this.disable();
                } else {
                    this.enable(); 
                }
               /**        
               Fired each time when element's text is rendered. Occurs on initialization and on each update of value.
               Can be used for display customization.
                              
               @event render 
               @param {Object} event event object
               @param {Object} editable editable instance
               @example
               $('#action').on('render', function(e, editable) {
                    var colors = {0: "gray", 1: "green", 2: "blue", 3: "red"};
                    $(this).css("color", colors[editable.value]);  
               });                  
               **/                  
                this.$element.triggerHandler('render', this);
                this.isInit = false;    
            }, this));
        },
        
        /**
        Enables editable
        @method enable()
        **/          
        enable: function() {
            this.options.disabled = false;
            this.$element.removeClass('editable-disabled');
            this.handleEmpty();
            if(this.options.toggle === 'click') {
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
        @param {string} key 
        @param {mixed} value 
        **/          
        option: function(key, value) {
            if(key === 'disabled') {
                if(value) {
                    this.disable();
                } else {
                    this.enable();
                }
                return;
            } 
                       
            this.options[key] = value;
            
            //transfer new option to container! 
            if(this.container) {
              this.container.option(key, value);  
            }
        },              
        
        /*
        * set emptytext if element is empty (reverse: remove emptytext if needed)
        */
        handleEmpty: function () {
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
        
        click: function (e) {
            e.preventDefault();
            if(this.options.disabled) {
                return;
            }
            //stop propagation bacause document listen any click to hide all editableContainers
            e.stopPropagation();
            this.toggle();
        },
        
        /**
        Shows container with form
        @method show()
        **/  
        show: function () {
            if(this.options.disabled) {
                return;
            }
            
            //init editableContainer: popover, tooltip, inline, etc..
            if(!this.container) {
                var containerOptions = $.extend({}, this.options, {
                    value: this.value,
                    autohide: false //element itsef will show/hide container
                });
                this.$element.editableContainer(containerOptions);
                this.$element.on({
                    save: $.proxy(this.save, this),
                    cancel: $.proxy(this.hide, this)
                });
                this.container = this.$element.data('editableContainer'); 
            } else if(this.container.tip().is(':visible')) {
                return;
            }      
                                         
            //hide all other editable containers. Required to work correctly with toggle = manual
            $('.editable-container').find('.editable-cancel').click();
            
            //show container
            this.container.show();
        },
        
        /**
        Hides container with form
        @method hide()
        **/       
        hide: function () {   
            if(this.container) {  
                this.container.hide();
            }
                
            //return focus on element
            if (this.options.enablefocus && this.options.toggle === 'click') {
                this.$element.focus();
            }                
        },
        
        /**
        Toggles container visibility (show / hide)
        @method toggle()
        **/  
        toggle: function() {
            if(this.container && this.container.tip().is(':visible')) {
                this.hide();
            } else {
                this.show();
            }
        },
        
        /*
        * called when form was submitted
        */          
        save: function(e, params) {
            //if url is not user's function and value was not sent to server and value changed --> mark element with unsaved css. 
            if(typeof this.options.url !== 'function' && params.response === undefined && this.input.value2str(this.value) !== this.input.value2str(params.newValue)) { 
                this.$element.addClass('editable-unsaved');
            } else {
                this.$element.removeClass('editable-unsaved');
            }
            
            this.hide();
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
                return this.options.validate.call(this, this.value);
            }
        },
        
        /**
        Sets new value of editable
        @method setValue(value, convertStr)
        @param {mixed} value new value 
        @param {boolean} convertStr whether to convert value from string to internal format
        **/         
        setValue: function(value, convertStr) {
            if(convertStr) {
                this.value = this.input.str2value(value);
            } else {
                this.value = value;
            }
            if(this.container) {
                this.container.option('value', this.value);
            }
            $.when(this.input.value2html(this.value, this.$element))
            .then($.proxy(function() {
                this.handleEmpty();
                this.$element.triggerHandler('render', this);                        
            }, this));
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
              username: "username is requied",
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
                        result[data.options.name] = data.input.value2str(data.value);
                    }
                });
            return result;

            /**  
            This method collects values from several editable elements and submit them all to server. 
            It is designed mainly for <a href="#newrecord">creating new records</a>. 
            
            @method submit(options)
            @param {object} options 
            @param {object} options.url url to submit data 
            @param {object} options.data additional data to submit
            @param {function} options.error(obj) error handler (called on both client-side and server-side validation errors)
            @param {function} options.success(obj) success handler 
            @returns {Object} jQuery object
            **/            
            case 'submit':  //collects value, validate and submit to server for creating new record
                var config = arguments[1] || {},
                $elems = this,
                errors = this.editable('validate'),
                values;

                if(typeof config.error !== 'function') {
                    config.error = function() {};
                } 

                if($.isEmptyObject(errors)) {
                    values = this.editable('getValue'); 
                    if(config.data) {
                        $.extend(values, config.data);
                    }
                    $.ajax({
                        type: 'POST',
                        url: config.url, 
                        data: values, 
                        dataType: 'json'
                    }).success(function(response) {
                        if(typeof response === 'object' && response.id) {
                            $elems.editable('option', 'pk', response.id); 
                            $elems.removeClass('editable-unsaved');
                            if(typeof config.success === 'function') {
                                config.success.apply($elems, arguments);
                            } 
                        } else { //server-side validation error
                            config.error.apply($elems, arguments);
                        }
                    }).error(function(){  //ajax error
                        config.error.apply($elems, arguments);
                    });
                } else { //client-side validation error
                    config.error.call($elems, {errors: errors});
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
        Type of input. Can be <code>text|textarea|select|date</code>

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
        How to toggle editable. Can be <code>click|manual</code>. 
        When set to <code>manual</code> you should manually call <code>show/hide</code> methods of editable.  
        Note: if you are calling <code>show</code> on **click** event you need to apply <code>e.stopPropagation()</code> because container has behavior to hide on any click outside.
        
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
        Allows to automatically set element's text based on it's value. Can be <code>auto|always|never</code>. Usefull for select and date.
        For example, if dropdown list is <code>{1: 'a', 2: 'b'}</code> and element's value set to <code>1</code>, it's html will be automatically set to <code>'a'</code>.  
        <code>auto</code> - text will be automatically set only if element is empty.  
        <code>always|never</code> - always(never) try to set element's text.

        @property autotext 
        @type string
        @default 'auto'
        **/          
        autotext: 'auto', 
        /**
        Wether to return focus on element after form is closed. 
        This allows fully keyboard input.

        @property enablefocus 
        @type boolean
        @default false
        **/          
        enablefocus: false,
        /**
        Initial value of input

        @property value 
        @type mixed
        @default element's text
        **/
        value: null
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