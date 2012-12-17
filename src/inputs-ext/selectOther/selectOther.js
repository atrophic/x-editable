/**
 SelectOther (dropdown with option for textbox entry)

 @class selectOther
 @extends list
 @final
 @example
 <a href="#" id="status" data-type="selectOther" data-pk="1" data-url="/post" data-original-title="Select status"></a>
 <script>
 $(function(){
     $('#status').editable({
        value: 2,
        source: [
            {value: 1, text: 'Active'},
            {value: 2, text: 'Blocked'},
            {value: 3, text: 'Deleted'},
            {value: 4, text: 'Other', isFreeForm: true}
        ]
     });
 });
 </script>
 **/
(function ($) {

    var SelectOther = function (options) {
        this.init('selectOther', options, SelectOther.defaults);
    };

    $.fn.editableutils.inherit(SelectOther, $.fn.editabletypes.list);

    $.extend(SelectOther.prototype, {

        renderList: function() {
            if(!$.isArray(this.sourceData)) {
                return;
            }

            for(var i=0; i<this.sourceData.length; i++) {
                this.$input.append($('<option>', {value: this.sourceData[i].value}).text(this.sourceData[i].text));
            }

            this.renderSecondary();

            // show the text box if the selection option is marked as free form.
            var self = this;
            this.$input.on('change', function() {
                var selectedValue = $(this).find('option:selected:first').val();
                var selectedItem = self.itemByTextOrOther(selectedValue);

                var shouldShowTextBox = selectedItem.isFreeForm !== undefined && selectedItem.isFreeForm === true;
                var textBoxIsVisible = self.$secondaryInput.is(':visible');

                if (shouldShowTextBox && !textBoxIsVisible) {
                    self.$secondaryInput.val('');
                    self.$secondaryInput.show().focus();
                }

                if (!shouldShowTextBox && textBoxIsVisible) {
                    self.$secondaryInput.hide();
                }
            });
        },

        renderSecondary: function() {
            this.$secondaryInput = $(this.options.secondaryTpl);
            if (this.options.secondaryInputClass) {
                this.$secondaryInput.addClass(this.options.secondaryInputClass);
            }
            else if (this.options.inputclass) {
                this.$secondaryInput.addClass(this.options.inputclass);
            }

            if (this.options.secondaryPlaceholder) {
                this.$secondaryInput.attr('placeholder', this.options.secondaryPlaceholder);
            }
            else if (this.options.placeholder) {
                this.$secondaryInput.attr('placeholder', this.options.placeholder);
            }

            this.$secondaryInput.css('display', 'inline-block');
            this.$secondaryInput.hide();
            this.$input.after(this.$secondaryInput);
        },


        html2value: function (html) {
            window.console.log('setting html');
            window.console.log(html);

            return null; // set value to first free form field if the text comes in
        },

        value2htmlFinal: function(value, element) {
            var text = '', item = this.itemByTextOrOther(value);
            if(item) {
                text = item.text;
            }
            if (item !== null && item.isFreeForm !== undefined && item.isFreeForm === true) {
                text = value;
            }

            SelectOther.superclass.constructor.superclass.value2html(text, element);
        },

        input2value: function() {
            var item = this.itemByTextOrOther(this.$input.val());

            if (item !== null && item.isFreeForm !== undefined && item.isFreeForm === true && this.$secondaryInput !== undefined) {
                return this.$secondaryInput.val();
            }

            if(item !== null) {
                return item.value;
            }

            return null;
        },

        value2input: function(value) {
            var item = this.itemByTextOrOther(value);

            if (item !== null && (item.isFreeForm === undefined || item.isFreeForm !== true)) {
                this.$input.val(value);
            }

            if (item !== null && item.isFreeForm !== undefined && item.isFreeForm === true && this.$secondaryInput !== undefined) {
                this.$input.val(item.value);
                this.$input.trigger('change');
                this.$secondaryInput.val(value);
            }
        },

        activate: function() {
            if (this.$secondaryInput !== undefined && this.$secondaryInput.is(':visible'))    {
                this.$secondaryInput.focus();
            }
            else if(this.$input.is(':visible')) {
                this.$input.focus();
            }
        },

        clear:  function() {
            this.$input.val(null);
            if (this.$secondaryInput !== undefined) {
                this.$secondaryInput.val(null);
            }
        },

        itemByTextOrOther: function(val) {

            if(!$.isArray(this.sourceData)) {
                return;
            }

            var firstFreeFormItem = null;
            for(var i=0; i<this.sourceData.length; i++){
                /*jshint eqeqeq: false*/
                if(this.sourceData[i].value == val) {
                    /*jshint eqeqeq: true*/
                    return this.sourceData[i];
                }

                // store the first free form item in case we need it
                if (this.sourceData[i].isFreeForm === true && firstFreeFormItem == null) {
                    firstFreeFormItem = this.sourceData[i];
                }
            }

            return firstFreeFormItem;
        },
        
        autosubmit: function() {
            var self = this;
            self.$input.on('change', function(){
                var $this = $(this);
                var item = self.itemByTextOrOther($this.val());

                // only submit on change if we're not on an "Other" item
                if (item !== null && (item.isFreeForm === undefined || item.isFreeForm !== true)) {
                    $this.closest('form').submit();
                }
            });

            self.$secondaryInput.on('keydown', function(e){
                if (e.which === 13) {
                    $(this).closest('form').submit();
                }
            });
        }
    });

    SelectOther.defaults = $.extend({}, $.fn.editabletypes.list.defaults, {
        /**
         @property tpl
         @default <select></select>
         **/
        tpl:'<select></select>',

        secondaryTpl: $.fn.editabletypes.text.defaults.tpl,

        secondaryInputClass: null,

        secondaryPlaceholder: null
    });

    $.fn.editabletypes.selectOther = SelectOther;

}(window.jQuery));