package com.flipbook.reader.plugins;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Нативный плагин для импорта книг через Storage Access Framework (SAF).
 *
 * SAF позволяет открывать файлы из любого провайдера документов
 * (локальное хранилище, Google Drive, облачные сервисы), обходя
 * ограничения Scoped Storage на Android 10+.
 *
 * Использование из JavaScript:
 *   const { Capacitor } = await import('@capacitor/core');
 *   const result = await Capacitor.Plugins.BookImport.pickFile();
 *   // result: { cancelled, base64, fileName, mimeType }
 */
@CapacitorPlugin(name = "BookImport")
public class BookImportPlugin extends Plugin {

    private static final int MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

    @PluginMethod()
    public void pickFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                "application/epub+zip",
                "application/x-fictionbook+xml",
                "application/xml",
                "text/xml",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/msword",
                "text/plain",
                "application/octet-stream"
        });

        startActivityForResult(call, intent, "pickFileResult");
    }

    @ActivityCallback
    private void pickFileResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            JSObject ret = new JSObject();
            ret.put("cancelled", true);
            call.resolve(ret);
            return;
        }

        try {
            takeReadPermissionIfAvailable(uri, result.getData());

            String fileName = getFileName(uri);
            String mimeType = getContext().getContentResolver().getType(uri);
            if (mimeType == null) {
                mimeType = "";
            }

            byte[] bytes = readFileBytes(uri);

            String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

            JSObject ret = new JSObject();
            ret.put("cancelled", false);
            ret.put("base64", base64);
            ret.put("fileName", fileName);
            ret.put("mimeType", mimeType);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Ошибка чтения файла: " + e.getMessage(), e);
        }
    }

    /**
     * Зафиксировать доступ к Uri, если провайдер это поддерживает.
     */
    private void takeReadPermissionIfAvailable(Uri uri, Intent resultData) {
        int grantedFlags = resultData.getFlags() &
                (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        if ((grantedFlags & Intent.FLAG_GRANT_READ_URI_PERMISSION) == 0) {
            return;
        }

        try {
            getContext().getContentResolver().takePersistableUriPermission(
                    uri,
                    grantedFlags & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
            );
        } catch (SecurityException ignored) {
            // Не все провайдеры поддерживают persistable-права — временного доступа достаточно.
        }
    }

    /**
     * Получить имя файла из Uri через ContentResolver.
     */
    private String getFileName(Uri uri) {
        String name = "book";
        try {
            try (Cursor cursor = getContext().getContentResolver().query(
                    uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIndex >= 0) {
                        name = cursor.getString(nameIndex);
                    }
                }
            }
        } catch (SecurityException ignored) {
            // Некоторые провайдеры могут запретить query(), даже если чтение через InputStream доступно.
            String pathSegment = uri.getLastPathSegment();
            if (pathSegment != null && !pathSegment.isBlank()) {
                name = pathSegment;
            }
        }
        return name;
    }

    /**
     * Прочитать содержимое файла в байтовый массив.
     */
    private byte[] readFileBytes(Uri uri) throws Exception {
        try (InputStream inputStream = getContext().getContentResolver().openInputStream(uri)) {
            if (inputStream == null) {
                throw new Exception("Не удалось открыть файл");
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int bytesRead;
            int totalRead = 0;
            while ((bytesRead = inputStream.read(chunk)) != -1) {
                totalRead += bytesRead;
                if (totalRead > MAX_FILE_SIZE) {
                    throw new Exception("Файл слишком большой (макс. 100 МБ)");
                }
                buffer.write(chunk, 0, bytesRead);
            }
            return buffer.toByteArray();
        }
    }
}
