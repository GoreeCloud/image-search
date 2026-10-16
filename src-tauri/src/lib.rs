#[cfg(target_os = "android")]
struct AndroidImageDownload(tauri::plugin::PluginHandle<tauri::Wry>);

#[cfg(target_os = "android")]
#[derive(serde::Deserialize)]
struct SavedImage {
    filename: String,
}

/// Android must only acknowledge success after MediaStore has persisted bytes.
#[tauri::command]
async fn save_image_android(
    app: tauri::AppHandle,
    url: String,
    title: String,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        let plugin = app.state::<AndroidImageDownload>();
        let saved: SavedImage = plugin
            .0
            .run_mobile_plugin_async("saveImage", serde_json::json!({
                "url": url,
                "title": title,
            }))
            .await
            .map_err(|error| format!("Android image download failed: {error}"))?;
        return Ok(saved.filename);
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, url, title);
        Err("Native Downloads is only available on Android.".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("image-download")
                .setup(|app, api| {
                    #[cfg(target_os = "android")]
                    {
                        use tauri::Manager;
                        let handle = api.register_android_plugin(
                            "com.goreecloud.imagesearch",
                            "ImageDownloadPlugin",
                        )?;
                        app.manage(AndroidImageDownload(handle));
                    }
                    #[cfg(not(target_os = "android"))]
                    let _ = (app, api);
                    Ok(())
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![save_image_android])
        .run(tauri::generate_context!())
        .expect("error while running Image Search");
}
