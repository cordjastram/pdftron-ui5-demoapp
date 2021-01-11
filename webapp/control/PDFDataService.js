sap.ui.define(["sap/base/Log"], function (Log) {
  "use strict";

  return {

    createFile: function (oModel, oPdfFile, onSuccess, onError) {

      oModel.create("/PdfFiles", oPdfFile, {
        success: onSuccess,
        error: onError
      });

    },


    updateFile: function (oModel, oPdfFile, onSuccess, onError) {

      var key = oModel.createKey("/PdfFiles", { Id: oPdfFile.Id });
      // update the PDF
      oModel.update(key, oPdfFile, {
        success: onSuccess,
        error: onError
      });
    },

    handleFormFields: function (oModel, arrFormFields, bFormImported) {
      if (bFormImported) {
        this._updateFormFields(oModel, arrFormFields);
      } else {
        this._createFormFields(oModel, arrFormFields);
      }
    },

    _createFormFields: function (oModel, fieldArray) {
      for (var i = 0; i < fieldArray.length; i++) {
        // create entity
        oModel.create("/PdfFormFields", fieldArray[i], {
          success: function (data) { },
          error: function (e) { }
        });
      }
    },

    _updateFormFields: function (oModel, fieldArray) {
      for (var i = 0; i < fieldArray.length; i++) {
        // create key
        const sPathToUpdate = oModel.createKey("/PdfFormFields", {
          Id: fieldArray[i].Id, Name: fieldArray[i].Name
        });
        // update entity
        oModel.update(sPathToUpdate, fieldArray[i], {
          success: function (data) { },
          error: function (e) { }
        });
      }
    },

    handleAnnotations: function (oModel, annotations) {
      this._createAnnotations(oModel, annotations.new);
      this._updateAnnotations(oModel, annotations.updated);
      this._deleteAnnotations(oModel, annotations.deleted);
    },


    _updateAnnotations: function (oModel, annotationArray) {
      for (var i = 0; i < annotationArray.length; i++) {
        const sPathToUpdate = oModel.createKey("/PdfAnnotations", {
          Id: annotationArray[i].Id, AnnotationId: annotationArray[i].AnnotationId
        });
        oModel.update(sPathToUpdate, annotationArray[i], null, {
          success: this.onSuccess,
          error: this.onError
        });
      }
    },

    _createAnnotations: function (oModel, annotationArray) {
      for (var i = 0; i < annotationArray.length; i++) {
        oModel.create('/PdfAnnotations', annotationArray[i], null, {
          success: this.onSuccess,
          error: this.onError
        });
      }
    },

    _deleteAnnotations: function (oModel, deletedAnnotations) {
      for (var i = 0; i < deletedAnnotations.length; i++) {
        const sPathToDelete = oModel.createKey("/PdfAnnotations", {
          Id: deletedAnnotations[i].id, AnnotationId: deletedAnnotations[i].annotationId
        });
        oModel.remove(sPathToDelete);
      }
    },

    onSuccess: function (data) {
      Log.info("success");
    },

    onError: function (e) {
      Log.error(e.message);
    }

  };
});