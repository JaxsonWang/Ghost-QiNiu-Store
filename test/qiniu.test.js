test('hasClass', () => {
  document.body.innerHTML = `<div class="site-wrapper container d-flex"></div>`
  expect(hasClass(getEle('.site-wrapper'), 'container')).toBe(true)
  expect(hasClass(getEle('.site-wrapper'), 'app-wrapper')).toBe(false)
})
