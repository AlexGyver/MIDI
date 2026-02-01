// пример как захостить приложение на еспшке через GyverHTTP
#include <Arduino.h>

#define WIFI_SSID ""
#define WIFI_PASS ""

#ifdef ESP8266
#include <ESP8266WiFi.h>
#else
#include <WiFi.h>
#endif

#include <GyverHTTP.h>
ghttp::Server<WiFiServer, WiFiClient> server(80);

// файл из билда
#include "my_project.h"

void setup() {
    Serial.begin(115200);

    // STA
    WiFi.mode(WIFI_AP_STA);
    if (strlen(WIFI_SSID)) {
        WiFi.begin(WIFI_SSID, WIFI_PASS);
        uint8_t tries = 20;
        while (WiFi.status() != WL_CONNECTED) {
            delay(500);
            Serial.print(".");
            if (!--tries) break;
        }
        Serial.print("Connected: ");
        Serial.println(WiFi.localIP());
    }

    // AP
    WiFi.softAP("AP ESP");
    Serial.print("AP: ");
    Serial.println(WiFi.softAPIP());

    // server
    server.begin();
    server.onRequest([](ghttp::ServerBase::Request req) {
        // index.html: not cache, gzip
        // script.js: cache, gzip
        // style.css: cache, gzip

        switch (req.path().hash()) {
            case su::SH("/"):
                server.sendFile_P(my_project_index, sizeof(my_project_index), "text/html", false, true);
                break;

            case su::SH("/script.js"):
                server.sendFile_P(my_project_script, sizeof(my_project_script), "text/javascript", true, true);
                break;

            case su::SH("/style.css"):
                server.sendFile_P(my_project_style, sizeof(my_project_style), "text/css", true, true);
                break;
        }
    });
}

void loop() {
    server.tick();
}