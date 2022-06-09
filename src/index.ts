import Body from './components/Body/Body';
import Title from './components/Title/Title';
// import './index.scss';

const renderApp = (root: HTMLElement) => {
  root.innerHTML = `${Title()}
                    ${Body()}`

}

renderApp(
  document.getElementById('root')
);
