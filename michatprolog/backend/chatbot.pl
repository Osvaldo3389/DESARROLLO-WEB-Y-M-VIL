:- use_module(library(http/thread_httpd)).
:- use_module(library(http/http_dispatch)).
:- use_module(library(http/http_json)).
:- use_module(library(http/http_parameters)).

% Configurar la ruta del servidor
:- http_handler(root(chat), handle_chat, []).

% Iniciar el servidor en el puerto 8080
iniciar_servidor(Port) :-
    http_server(http_dispatch, [port(Port)]).

% Base de conocimiento / Reglas del Chatbot
responder('hola', 'Hola! En qué te puedo ayudar hoy?').
responder('como estas', 'Soy un programa en Prolog, así que funciono de maravilla!').
responder('adios', '¡Hasta luego! Que tengas un excelente día.').
responder(_, 'Interesante pregunta. No tengo una regla específica para eso todavía, pero lo estoy pensando.') :- !.

% Manejador de la petición HTTP
handle_chat(Request) :-
    % Permitir CORS para que la página web pueda conectarse
    format('Access-Control-Allow-Origin: *~n'),
    format('Access-Control-Allow-Headers: Content-Type~n'),
    http_parameters(Request, [
        mensaje(Mensaje, [default('')])
    ]),
    % Convertir a minúsculas y átomos para buscar en las reglas
    atom_string(AtomMsg, Mensaje),
    (   responder(AtomMsg, Respuesta)
    ->  true
    ;   Respuesta = 'No entendí tu mensaje.'
    ),
    % Responder en formato JSON
    reply_json(json([respuesta=Respuesta])).