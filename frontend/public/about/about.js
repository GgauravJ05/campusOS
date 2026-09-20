/*
 * Behaviour for the public page. jQuery (B25IT404 Unit 4) handles the DOM and
 * events; XMLHttpRequest (Unit 5) does the one call to the API.
 */
(function ($) {
  'use strict';

  /* ---- 1. XMLHttpRequest: is the API up? ---------------------------------- */

  /**
   * GET /api/health with a raw XMLHttpRequest, no fetch and no library.
   * The four readyState values are handled by onload / onerror / ontimeout.
   */
  function checkApi(done) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/health', true);
    xhr.timeout = 5000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.onload = function () {
      if (xhr.status !== 200) return done({ ok: false, reason: 'HTTP ' + xhr.status });
      try {
        var body = JSON.parse(xhr.responseText);
        var data = body.data || body;
        done({ ok: true, version: data.version, uptime: data.uptimeSeconds, environment: data.environment });
      } catch {
        done({ ok: false, reason: 'unreadable response' });
      }
    };
    xhr.onerror = function () { done({ ok: false, reason: 'no connection' }); };
    xhr.ontimeout = function () { done({ ok: false, reason: 'timed out' }); };
    xhr.send();
  }

  function showStatus(result) {
    var $badge = $('#api-status');
    $badge.removeClass('text-bg-secondary text-bg-success text-bg-danger');
    if (result.ok) {
      $badge.addClass('text-bg-success').text('API online');
      $('#api-detail').text('Version ' + result.version + ', up ' + result.uptime + ' s, ' + result.environment + ' mode.');
    } else {
      $badge.addClass('text-bg-danger').text('API offline');
      $('#api-detail').text('Could not reach the API (' + result.reason + ').');
    }
  }

  /* ---- 2. jQuery: filter the feature cards by audience ------------------------ */

  function bindFeatureFilter() {
    $('#feature-filter').on('click', 'button[data-audience]', function () {
      var audience = $(this).data('audience');
      $('#feature-filter button').removeClass('active').attr('aria-pressed', 'false');
      $(this).addClass('active').attr('aria-pressed', 'true');
      $('.feature-card').each(function () {
        var show = audience === 'all' || $(this).data('audience') === audience;
        $(this).toggle(show);
      });
      $('#feature-count').text($('.feature-card:visible').length + ' shown');
    });
  }

  /* ---- 3. Contact form validation ------------------------------------------------ */

  function bindContactForm() {
    var $form = $('#contact-form');

    function render(errors) {
      $form.find('[name]').each(function () {
        var name = $(this).attr('name');
        var message = errors[name];
        $(this).toggleClass('is-invalid', Boolean(message)).toggleClass('is-valid', !message);
        $('#' + name + '-error').text(message || '');
      });
    }

    function values() {
      return {
        name: $form.find('[name=name]').val(),
        email: $form.find('[name=email]').val(),
        mobile: $form.find('[name=mobile]').val(),
        message: $form.find('[name=message]').val(),
      };
    }

    // Validate a field as soon as the person leaves it, then live while they fix it.
    $form.on('blur', '[name]', function () { render(CampusValidate.validateContact(values())); });
    $form.on('input', '[name].is-invalid', function () { render(CampusValidate.validateContact(values())); });
    $form.find('[name=message]').on('input', function () {
      $('#message-count').text($(this).val().length + ' / 500');
    });

    $form.on('submit', function (event) {
      event.preventDefault();
      var errors = CampusValidate.validateContact(values());
      render(errors);
      var $result = $('#contact-result');
      if (Object.keys(errors).length > 0) {
        $result.removeClass('alert-success').addClass('alert-danger').text('Please fix the highlighted fields.').show();
        $form.find('.is-invalid').first().trigger('focus');
        return;
      }
      // There is deliberately no server endpoint for this form: the page shows what
      // was validated and does not send it anywhere.
      $result.removeClass('alert-danger').addClass('alert-success')
        .text('Looks good. This demo form checks your details in the browser and does not send them.').show();
    });
  }

  /* ---- start ---------------------------------------------------------------------- */

  $(function () {
    $('#year').text(new Date().getFullYear());
    bindFeatureFilter();
    bindContactForm();
    checkApi(showStatus);
    $('#api-recheck').on('click', function () {
      $('#api-status').removeClass('text-bg-success text-bg-danger').addClass('text-bg-secondary').text('Checking…');
      checkApi(showStatus);
    });
  });
})(jQuery);
