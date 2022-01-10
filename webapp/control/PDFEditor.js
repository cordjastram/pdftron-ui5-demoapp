sap.ui.define(
  [
    "sap/ui/core/Control",
    "sap/base/Log",
    "../pdftron/lib/webviewer.min"  // STEP 1: Loading the library 
  ],
  function (Control, Log, _PDFTron) {
    "use strict";
    return Control.extend("com.cjastram.ui5.control.PDFEditor", {

      /* =========================================================== */
      /* metadata                                                    */
      /* =========================================================== */

      metadata: {
        /* properties */
        properties: {
          width: {
            type: "sap.ui.core.CSSSize",
            defaultValue: "100%",
          },
          height: {
            type: "sap.ui.core.CSSSize",
            defaultValue: "100%",
          },
          readonly: {
            type: "boolean",
            defaultValue: false
          },
          theme: {
            type: "string",
            defaultValue: "light"
          },
          username: {
            type: "string"
          },
          data: {
            type: "string",
            defaultValue: null
          }
        },

        aggregations: {
          buttons: { type: "com.cjastram.PDFEditor.control.Button", multiple: true, singularName: "Button" }
        },

        events: {
          press: {
            parameters: {
              name: { type: "string" }
            }
          },
          documentLoaded: {
            parameters: {}
          }

        }
      },

      /* =========================================================== */
      /* lifecycle functions                                         */
      /* =========================================================== */

      init: function () {
        this._delayedCalls = [];
        this._deletedAnnotations = new Map();
        this._updatedAnnotations = new Map();
        this._addedAnnotations = new Map();
      },

      /* =========================================================== */
      /* renderer functions                                          */
      /* =========================================================== */

      renderer: function (oRm, oControl) {
        // STEP 2: Creating a DIV tag
        // creates the root element incl. the Control ID 
        oRm.openStart("div", oControl);
        // write the Control property width and height 
        oRm.style("width", oControl.getWidth());
        oRm.style("height", oControl.getHeight());
        oRm.openEnd();
        // close
        oRm.close("div");
      },

      onAfterRendering: function () {
        // STEP 3: Initialize the WebViewer control
        WebViewer(
          {
            path: "./pdftron/lib",
            ui: "beta",
            backendType: "ems",
            fullAPI: true,
          },
          document.getElementById(this.getId())
        ).then(
          function (oWebViewer) {
            this._setupWebViewer(oWebViewer);
          }.bind(this)
        );
      },

      /* =========================================================== */
      /* setter for WebViewer properties                             */
      /* =========================================================== */

      setData: function (data) {
        if (data && data.length > 0) {
          var blob = new Blob([this.base64ToArrayBuffer(data)], { type: "application/pdf" });
          this._callOrDelay(
            function (oViewer) { oViewer.loadDocument(blob, {}) }
          );
        }
      },

      setReadonly: function (bVal) {
        this._callOrDelay(function (oViewer) {
          if (bVal) {
            oViewer.annotManager.enableReadOnlyMode();
          } else {
            oViewer.annotManager.disableReadOnlyMode();
          }
        });
      },

      setUsername: function (sName) {
        if (sName && sName.length > 0) {
          this._callOrDelay(function (oViewer) { oViewer.docViewer.getAnnotationManager().setCurrentUser(sName) });
        }
      },

      setTheme: function (sTheme) {
        this._callOrDelay(function (oViewer) { oViewer.setTheme(sTheme) });
      },

      /* =========================================================== */
      /* PDFTron API extensions                                       */
      /* =========================================================== */

      getPDFMetadata: function () {
        return this._webViewer.docViewer.getDocument().getMetadata();
      },

      /**/
      getFormFields: function (documentId, onlyModified) {
        var fieldArray = [];
        var fieldManager = this._webViewer.annotManager.getFieldManager();

        fieldManager.forEachField(
          function (field) {
            this._getFields(documentId, field, fieldArray, onlyModified);
          }.bind(this)
        );
        return fieldArray;
      },

      getAnnotations: function (documentId, customData) {

        var annotsUpdated = [];
        var annotsNew = [];
        var annotList = this._webViewer.annotManager.getAnnotationsList();

        for (var i = 0; i < annotList.length; i++) {

          const annotation = annotList[i];

          if (annotation.elementName != 'text') continue;

          var customData = annotation.getCustomData("sap");

          if (customData != "add" && customData != "modify") continue;

          const newAnnot = {
            Id: documentId,
            AnnotationId: annotation.Id,
            InReplyTo: annotation.InReplyTo,
            Author: annotation.Author,
            State: annotation.getState(),
            YPos: annotation.getY() * 100,
            Content: annotation.getContents(),
            PageNr: annotation.getPageNumber(),
          };

          switch (customData) {
            case "add":
              annotsNew.push(newAnnot);
              break;
            case "modify":
              annotsUpdated.push(newAnnot);
              break;
            default:
              Log.error("Invalid customdata: " + customData);
          }
        }
        return { new: annotsNew, updated: annotsUpdated, deleted: this._getDeletedAnnotations(documentId) };
      },

      setAnnotationsCustomData: function (key, value) {
        var annotList = this._webViewer.annotManager.getAnnotationsList();

        for (var i = 0; i < annotList.length; i++) {
          if (annotList[i].elementName == 'text') {
            annotList[i].setCustomData(key, value);
          }
        }
      },

      /**
       *  returns an array of with the {id, annotationId} pairs of all deleted annotations              
       * 
       * @private 
       * @param {@} id 
       */
      _getDeletedAnnotations: function (id) {
        const iterator = this._deletedAnnotations.keys();
        var arrKeys = [];
        var key = iterator.next().value;

        while (key) {
          arrKeys.push({ id: id, annotationId: key });
          key = iterator.next().value;
        }
        this._deletedAnnotations = new Map();
        return arrKeys;
      },

      _getFields: function (documentId, field, arr, onlyModified) {
        if (field.children.length > 0) {
          field.children.forEach(
            function (child) {
              this._getFields(documentId, child, arr);
            }.bind(this)
          );
        } else {
          if (!onlyModified || field.IsModified) {
            arr.push({
              Id: documentId,
              Name: field.name,
              Value: field.value,
            });
          }
        }
      },

      _callOrDelay: function (delayedCall) {
        if (this._webViewer) {
          delayedCall(this._webViewer);
        } else {
          this._delayedCalls.push(delayedCall);
        }
      },

      _setupAnnotationEvents: function () {

        const { docViewer, annotManager } = this._webViewer;

        docViewer.on("documentLoaded", () => {

          var buttonsToDisable = [];
          var buttonsToEnable = [];

          this.fireDocumentLoaded();

          const buttons = this.getAggregation("buttons");

          for (var i = 0; i < buttons.length; i++) {

            const name = buttons[i].getProperty("name");
            if (buttons[i].getProperty("disabled")) {
              buttonsToDisable.push(name);
            } else {
              buttonsToEnable.push(name);
            }
          }
          this._webViewer.disableElements(buttonsToDisable);
          this._webViewer.enableElements(buttonsToEnable);
        });

        annotManager.on("annotationChanged", (annotations, action) => {

          annotations.forEach((annot) => {

            if (annot.elementName == "text") {

              var customData = annot.getCustomData("sap");
              switch (action) {

                case 'add':
                  if (!customData) {
                    annot.setCustomData("sap", 'add');
                  }
                  break;

                case 'delete':
                  if (customData != 'add') {
                    this._deletedAnnotations.set(annot.Id, action)
                  }
                  break;

                case 'modify':
                  if (customData != 'add') {
                    annot.setCustomData("sap", 'modify');
                  }
                  break;
              }
            }
          });

        });
      },

      _createButtons: function () {
        const buttons = this.getAggregation("buttons");

        if (buttons) {
          this._webViewer.setHeaderItems((header) => {

            for (var i = 0; i < buttons.length; i++) {
              var button = buttons[i];
              const buttonName = button.getProperty("name")
              const buttonType = button.getProperty("type");
              button._instance = this._webViewer;

              switch (buttonType) {
                case "divider":
                  header.push({ type: buttonType });
                  break;

                case "actionButton":
                  header.push({
                    type: buttonType,
                    title: button.getProperty("title"),
                    dataElement: buttonName,
                    img: button.getProperty("image"),
                    onClick: (() => {
                      this.firePress({ name: buttonName });
                    })
                  });
                  break;
              }
            }
          })
        }
      },

      _processDelayedFunctions: function () {
        for (var i = 0; i < this._delayedCalls.length; i++) {
          this._delayedCalls[i](this._webViewer);
          delete this._delayedCalls[i];
        }
        this._delayedCalls = [];
      },

      /*
      */
      _setupWebViewer(oWebViewer) {
        Log.info("_setupWebViewer");
        this._webViewer = oWebViewer;
        this._setupAnnotationEvents();
        this._processDelayedFunctions();
        this._createButtons();
      },

      /*
            return
      */
      getFileData: function (flattenFormFields) {

        return this._webViewer.annotManager
          .exportAnnotations()
          .then(function (xfdfString) {
            return this._webViewer.docViewer.getDocument().getFileData({
              xfdfString,
              flatten: flattenFormFields,
            });
          }.bind(this));
      },

      base64ToArrayBuffer: function (base64) {

        let binary_string = window.atob(base64);
        let len = binary_string.length;
        var bytes = new Uint8Array(len);
        for (var i = 0; i < len; i++) {
          bytes[i] = binary_string.charCodeAt(i);
        }
        return bytes.buffer;

      },

      /*
          convert a buffer to a base64 string
      */
      arrayBufferToBase64: function (buffer) {
        var binary = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      },

      /*
      
      */
    });
  }
);
