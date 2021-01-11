sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/base/Log",
    "./Util",
    "../control/PDFDataService"
  ],
  function (BaseController, JSONModel, History, MessageToast, Fragment, Log, Util, PDFDataService) {
    "use strict";

    return BaseController.extend("com.cjastram.PDFEditor.controller.Object", {

      /* =========================================================== */
      /* lifecycle methods                                           */
      /* =========================================================== */

      /**
       * Called when the worklist controller is instantiated.
       * @public
       */
      onInit: function () {
        // Model used to manipulate control states. The chosen values make sure,
        // detail page is busy indication immediately so there is no break in
        // between the busy indication for loading the view's meta data
        var iOriginalBusyDelay,
          oViewModel = new JSONModel({
            busy: true,
            delay: 0,
          });

        this.getRouter()
          .getRoute("object")
          .attachPatternMatched(this._onObjectMatched, this);

        // Store original busy indicator delay, so it can be restored later on
        iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
        this.setModel(oViewModel, "objectView");

        this.getOwnerComponent()
          .getModel()
          .metadataLoaded()
          .then(function () {
            // Restore original busy indicator delay for the object view
            oViewModel.setProperty("/delay", iOriginalBusyDelay);
          });
      },

      /**
       * Event handler  for handling press events for buttons of a PDFEditor control.
       * @public
       */

      onPdfEditorButtonPress: function (oEvent) {

        const btnName = oEvent.getParameter("name");
        const oPDFEditor = oEvent.getSource();

        switch (btnName) {
          case "btnSave":
            this.showSaveFileDialog(oPDFEditor);
            break;

          case "btnInfo":
            this.showFileInfoDialog(oPDFEditor);
            break;
        }
      },

      onDocumentLoaded: function (oEvent) {
        MessageToast.show('Document loaded!');
      },

      /* =========================================================== */
      /* event handlers                                              */
      /* =========================================================== */

      /**
       * Event handler  for navigating back.
       * It there is a history entry we go one step back in the browser history
       * If not, it will replace the current entry of the browser history with the worklist route.
       * @public
       */
      onNavBack: function () {
        var sPreviousHash = History.getInstance().getPreviousHash();

        if (sPreviousHash !== undefined) {
          history.go(-1);
        } else {
          this.getRouter().navTo("worklist", {}, true);
        }
      },

      closeSaveDialog: function () {
        this._saveFileDialog.close();
      },

      closeInfoDialog: function () {
        this._fileInfoDialog.close();
      },

      saveFile: function () {
        // Step 1:  close dialog
        this.closeSaveDialog();

        // Step 2:  get data from dialog
        const oSaveFileModel = this._saveFileDialog.getModel();
        const oPDFEditor = oSaveFileModel.getProperty("/PdfEditor");
        const flattenFile = oSaveFileModel.getProperty("/FlattenFile");
        const newDescription = oSaveFileModel.getProperty("/Description");

        // Step 3: get model and the current entity
        const oModel = this.getModel();
        const oObject = oModel.getObject(this._sObjectPath);

        // Step 4: get annotaitons and form
        const annotations = oPDFEditor.getAnnotations(oObject.Id);
        oPDFEditor.setAnnotationsCustomData("sap","saved");
        const formFields = oPDFEditor.getFormFields(oObject.Id, oObject.FormImported);

        // Step 5 get the modified file data
        oPDFEditor.getFileData(flattenFile).then(function (newPDFData) {

          // Step 6: my modified PdfFile entity
          var oModifiedFile = {
            Id: oObject.Id,
            Cdate: oObject.Cdate,
            Description: newDescription,
            FileName: oObject.FileName,
            Flattened: flattenFile,
            FormImported: true,
            Data: Util.arrayBufferToBase64(newPDFData)
          };
          // Step 7: function called after the file data is updated
          var onSuccess = function () {
            // handle form fields and annotations
            PDFDataService.handleFormFields(oModel, formFields, oObject.FormImported);
            PDFDataService.handleAnnotations(oModel, annotations);
            // submit changes
            oModel.submitChanges();
          }
          // Step 8: function called when file update fails
          var onError = function ( ) { MessageToast.show('Document update failed! '); }

          // Step 9
          PDFDataService.updateFile(oModel, oModifiedFile, onSuccess, onError);

        }); 
      },

      onSearch: function (oEvent) {

        if (oEvent.getParameters().refreshButtonPressed) {
          this.onRefresh();
        } else {
          var aTableSearchState = [];
          var sQuery = oEvent.getParameter("query");

          if (sQuery && sQuery.length > 0) {
            aTableSearchState = [new Filter("FileName", FilterOperator.Contains, sQuery)];
          }
          this._applySearch(aTableSearchState);
        }
      },

      showSaveFileDialog: function (oPDFEditor) {

        if (this._sObjectPath) {

          var oFileModel = new JSONModel();

          oFileModel.setProperty("/Description", this.getView().getBindingContext().getObject().Description);
          oFileModel.setProperty("/PdfEditor", oPDFEditor);

          if (!this._saveFileDialog) {
            Fragment.load({
              name: "com.cjastram.PDFEditor.view.FileSaveDialog",
              controller: this
            }).then(function (oDialog) {
              this._saveFileDialog = oDialog;
              this.getView().addDependent(this._saveFileDialog);
              this._saveFileDialog.setModel(oFileModel);
              this._saveFileDialog.open();
            }.bind(this));
          } else {
            this._saveFileDialog.setModel(oFileModel);
            this._saveFileDialog.open();
          };
        }

      },

      showFileInfoDialog: function (oPDFEditor) {

        if (this._sObjectPath) {

          oPDFEditor.getPDFMetadata().then(function (oMetadata) {

            var oFileInfoModel = new JSONModel();

            oFileInfoModel.setProperty("/Application", oMetadata.application);
            oFileInfoModel.setProperty("/Keywords", oMetadata.keywords);
            oFileInfoModel.setProperty("/Creator", oMetadata.creator);
            oFileInfoModel.setProperty("/Header", oMetadata.header);
            oFileInfoModel.setProperty("/Producer", oMetadata.producer);
            oFileInfoModel.setProperty("/Title", oMetadata.title);
            oFileInfoModel.setProperty("/Subject", oMetadata.subject);

            if (!this._fileInfoDialog) {
              Fragment.load({
                name: "com.cjastram.PDFEditor.view.FileInfoDialog",
                controller: this
              }).then(function (oDialog) {

                this._fileInfoDialog = oDialog;
                this.getView().addDependent(this._fileInfoDialog);
                this._fileInfoDialog.setModel(oFileInfoModel);
                this._fileInfoDialog.open();
              }.bind(this));
            } else {
              this._fileInfoDialog.setModel(oFileInfoModel);
              this._fileInfoDialog.open();
            };

          }.bind(this));
        }
      },

      /* =========================================================== */
      /* internal methods                                            */
      /* =========================================================== */

      /**
       * Binds the view to the object path.
       * @function
       * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
       * @private
       */
      _onObjectMatched: function (oEvent) {
        var sObjectId = oEvent.getParameter("arguments").objectId;

        this.getModel()
          .metadataLoaded()
          .then(
            function () {
              var sObjectPath = this.getModel().createKey("/PdfFiles", {
                Id: sObjectId,
              });
              this._sObjectPath = sObjectPath;
              this._bindView(sObjectPath);
            }.bind(this)
          );
      },

      /**
       * Binds the view to the object path.
       * @function
       * @param {string} sObjectPath path to the object to be bound
       * @private
       */
      _bindView: function (sObjectPath) {

        var oViewModel = this.getModel("objectView"),
          oDataModel = this.getModel();

        this.getView().bindElement({
          path: sObjectPath,
          events: {
            change: this._onBindingChange.bind(this),
            dataRequested: function () {
              oDataModel.metadataLoaded().then(function () {
                // Busy indicator on view should only be set if metadata is loaded,
                // otherwise there may be two busy indications next to each other on the
                // screen. This happens because route matched handler already calls '_bindView'
                // while metadata is loaded.
                oViewModel.setProperty("/busy", true);
              });
            },
            dataReceived: function () {
              oViewModel.setProperty("/busy", false);
            },
          },
        });
      },

      _onBindingChange: function () {
        var oView = this.getView(),
          oViewModel = this.getModel("objectView"),
          oElementBinding = oView.getElementBinding();

        // No data for the binding
        if (!oElementBinding.getBoundContext()) {
          this.getRouter().getTargets().display("objectNotFound");
          return;
        }

        var oObject = oView.getBindingContext().getObject();

        oViewModel.setProperty("/busy", false);
      },
    });
  }
);
