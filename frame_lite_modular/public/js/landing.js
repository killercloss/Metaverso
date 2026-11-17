'use strict';
const menu = document.querySelector('.menu-toggle');
const links = document.querySelector('#navlinks');
menu?.addEventListener('click', () =>
{
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    links.classList.toggle('open', !expanded);
});
links?.querySelectorAll('a').forEach(link => link.addEventListener('click', () =>
{
    menu?.setAttribute('aria-expanded', 'false');
    links.classList.remove('open');
}));
document.querySelector('#year').textContent = String(new Date().getFullYear());
