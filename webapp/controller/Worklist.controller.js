sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/Fragment",
	"sap/m/MessageBox",
	"sap/m/MessageToast"

], function (BaseController, JSONModel, Filter, FilterOperator, Fragment, MessageBox, MessageToast) {
	"use strict";

	return BaseController.extend("com.cjastram.PDFEditor.controller.Worklist", {


		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			var oViewModel,
				oUploadModel,
				iOriginalBusyDelay,
				oTable = this.byId("table");

			// Put down worklist table's original value for busy indicator delay,
			// so it can be restored later on. Busy handling on the table is
			// taken care of by the table itself.
			iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
			// keeps the search state
			this._aTableSearchState = [];

			// Model used to manipulate control states
			oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				shareOnJamTitle: this.getResourceBundle().getText("worklistTitle"),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				tableBusyDelay: 0
			});
			this.setModel(oViewModel, "worklistView");
			this.setModel(oUploadModel, "upload");

			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oTable.attachEventOnce("updateFinished", function () {
				// Restore original busy indicator delay for worklist's table
				oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function (oEvent) {
			// update the worklist's object counter after the table update
			var sTitle,
				oTable = oEvent.getSource(),
				iTotalItems = oEvent.getParameter("total");
			// only update the counter if the length is final and
			// the table is not empty
			if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
			} else {
				sTitle = this.getResourceBundle().getText("worklistTableTitle");
			}
			this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
		},



		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPress: function (oEvent) {
			// The source is the list item that got pressed
			this._showObject(oEvent.getSource());
		},

		uploadFile: function () {
			this.byId("fileUploaderId").upload();
		},

		showUploadDialog: function (oEvent) {

			var oFileModel = new JSONModel();

			if (!this._uploadFileDialog) {

				Fragment.load({
					id: this.getView().getId(),
					name: "com.cjastram.PDFEditor.view.FileUploadDialog",
					controller: this
				}).then(function (oDialog) {
					this._uploadFileDialog = oDialog;
					this.getView().addDependent(this._uploadFileDialog);
					this._uploadFileDialog.setModel(oFileModel);
					this._uploadFileDialog.open();
				}.bind(this));
			} else {
				this._uploadFileDialog.open();
			}
		},

		closeUploadDialog: function (oEvent) {
			this._uploadFileDialog.close();
		},

		fileUploadComplete: function (oEvent) {

			var oUploadModel = this._uploadFileDialog.getModel();

			var oFileUpload = this.getView().byId("fileUploaderId");
			var file = oFileUpload.getFocusDomRef().files[0];
 
			var reader = new FileReader();

			var description = oUploadModel.getProperty("/Description");

			reader.onload = function (e) {

				var textToReplace = "data:" + file.type + ";base64,";
				var pdfData = e.currentTarget.result.replace(textToReplace, "");

				var oPdfFile = {
					Id: "00000000-0000-0000-0000-000000000000", 
					Description: description,
					FileName: file.name,
					Data: pdfData
				};

				var onSuccess = function (data) {
					MessageToast.show('Document uploaded!');
					this._uploadFileDialog.close();
				}.bind(this);

				var onError = function (e) {
					MessageToast.show('Document upload failed!');
					this._uploadFileDialog.close();
				}.bind(this);

				this._createPdfFile(oPdfFile, onSuccess, onError);
			}.bind(this);
			
			reader.readAsDataURL(file);
		},

		_createPdfFile: function (oPdfFile, onSuccess, onError) {

			this.getModel().create("/PdfFiles", oPdfFile, {
				success: function (data) {
					onSuccess(data);
				}.bind(this),
				error: function (e) {
					onError(e);
				}
			});
		},

		/**
		 * Event handler for navigating back.
		 * We navigate back in the browser history
		 * @public
		 */
		onNavBack: function () {
			// eslint-disable-next-line sap-no-history-manipulation
			history.go(-1);
		},

		/**
		 * Event handler for search event.
		 * Updates binding for file list es the list binding.
		 * @public
		 */
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

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			var oTable = this.byId("table");
			oTable.getBinding("items").refresh();
		},

		/**
		 * Event handler for delete document event.
		 * @param {sap.ui.base.Event} event
		 */
		deleteFile: function (oEvent) {
			 
			var sPathToDelete = this.getModel().createKey("/PdfFiles", {
				Id: oEvent.getSource().data("Id")  
			});

			MessageBox.warning("Press OK to delete file!", {
				actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
				emphasizedAction: MessageBox.Action.OK,
				onClose: function (sAction) {
					if (sAction === 'OK') {
						this.getModel().remove( sPathToDelete, {
							method: "DELETE",
							success: function (data) {
								MessageToast.show('Document deleted!');
							},
							error: function () {
								MessageToast.show('Document could not be deleted!');
							}
						});
					}
				}.bind(this)
			});
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function (oItem) {
			this.getRouter().navTo("object", {
				objectId: oItem.getBindingContext().getProperty("Id")
			});
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
		 * @private
		 */
		_applySearch: function (aTableSearchState) {
			var oTable = this.byId("table"),
				oViewModel = this.getModel("worklistView");
			oTable.getBinding("items").filter(aTableSearchState, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aTableSearchState.length !== 0) {
				oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
			}
		}

	});
});