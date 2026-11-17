# Audio independiente por salón

Siete canales lógicos de escucha: pasillo y salones 1 a 6.
La zona se determina automáticamente con las coordenadas del avatar.
Solo se escucha a quienes están en la misma zona. Al cruzar una puerta, cambia el canal.
No se modifica el mecanismo WebRTC existente: los peers continúan conectados, pero su audio se silencia cuando están en zonas distintas.
Esto es aislamiento de reproducción en el cliente, no aislamiento de transmisión ni privacidad criptográfica. Para privacidad real por sala, se necesita señalización y suscripción de medios por sala en el servidor.
El pasillo también se utiliza como zona exterior al edificio.
Verificar con dos o más navegadores; la prueba automatizada solo valida sintaxis.
