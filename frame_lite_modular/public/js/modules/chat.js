export function createChatSystem(options)
{
    const { socket, messages, input, sendButton, getName } = options;

    function addMessage(data)
    {
        const message = document.createElement('div');
        const name = document.createElement('span');
        const text = document.createElement('span');

        message.className = 'chatMessage';
        name.className = 'chatName';
        name.textContent = `${data.name || 'Guest'}: `;
        text.textContent = data.text || '';

        message.append(name, text);
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
    }

    function send()
    {
        const text = input.value.trim();

        if(!text)
        {
            return;
        }

        socket.emit('chatMessage',
        {
            name: getName(),
            text
        });

        input.value = '';
    }

    sendButton.addEventListener('click', send);
    input.addEventListener('keydown', event =>
    {
        if(event.key === 'Enter')
        {
            event.preventDefault();
            send();
        }
    });

    socket.on('chatMessage', addMessage);

    return { addMessage, send };
}
