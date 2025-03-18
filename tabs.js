document.addEventListener("DOMContentLoaded", function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(function(button) {
    button.addEventListener('click', function() {
      // Remove the active class from all buttons and content panels
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Add the active class to the clicked button and corresponding content panel
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      const content = document.getElementById(tabId);
      if (content) {
        content.classList.add('active');
      }
    });
  });
});