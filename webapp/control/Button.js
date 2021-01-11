
sap.ui.define([
  "sap/ui/base/ManagedObject"
], function (
  ManagedObject
) {
  "use strict";

  return ManagedObject.extend("com.cjastram.PDFEditor.control.Button", {
    metadata: {
      properties: {
        type: {
          type: "string",
          defaultValue: "actionButton",
        },
        title: {
          type: "string",
          defaultValue: "",
        },
        image: {
          type: "string",
          defaultValue: ""
        },
        name: {
          type: "string"
        },
        disabled: {
          type: "boolean",
          default: false
        }
      }
    },

    /*
    * setting the disabled flag without invalidating the control
    */
    setDisabled: function (bVal) {
       this.setProperty('disabled', bVal, true);
    }
  });
});


