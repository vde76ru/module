// frontend/src/pages/Procurement/ProcurementCenter.jsx
import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  Tooltip,
  FormHelperText,
  Checkbox,
  TablePagination,
  InputAdornment,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Send as SendIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  LocalShipping as LocalShippingIcon,
  Inventory as InventoryIcon,
  AttachMoney as AttachMoneyIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Block as BlockIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import ruLocale from 'date-fns/locale/ru';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

const ProcurementCenter = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [draftOrders, setDraftOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [expandedOrders, setExpandedOrders] = useState({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [excludeDialogOpen, setExcludeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [excludeReason, setExcludeReason] = useState('');
  const [excludeNotes, setExcludeNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const { enqueueSnackbar } = useSnackbar();

  const excludeReasons = [
    { value: 'manual_exclude', label: 'Исключено вручную' },
    { value: 'out_of_stock', label: 'Нет в наличии у поставщика' },
    { value: 'price_too_high', label: 'Слишком высокая цена' },
    { value: 'temporary_hold', label: 'Временная приостановка' },
    { value: 'other', label: 'Другая причина' }
  ];

  const orderStatuses = [
    { value: 'draft', label: 'Черновик', color: 'default' },
    { value: 'pending', label: 'Ожидает отправки', color: 'warning' },
    { value: 'sent', label: 'Отправлен', color: 'info' },
    { value: 'confirmed', label: 'Подтвержден', color: 'success' },
    { value: 'processing', label: 'В обработке', color: 'primary' },
    { value: 'shipped', label: 'Отгружен', color: 'secondary' },
    { value: 'delivered', label: 'Доставлен', color: 'success' },
    { value: 'cancelled', label: 'Отменен', color: 'error' }
  ];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [suppliersRes] = await Promise.all([
        axios.get('/api/suppliers')
      ]);
      
      setSuppliers(suppliersRes.data);

      if (activeTab === 0) {
        const draftsRes = await axios.get('/api/procurement/draft-orders');
        setDraftOrders(draftsRes.data);
      } else {
        const historyRes = await axios.get('/api/procurement/order-history', {
          params: {
            search: searchQuery,
            supplier: filterSupplier,
            status: filterStatus,
            dateFrom,
            dateTo,
            page,
            limit: rowsPerPage
          }
        });
        setOrderHistory(historyRes.data);
      }
    } catch (error) {
      enqueueSnackbar('Ошибка загрузки данных', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    setSelectedOrders([]);
    setExpandedOrders({});
  };

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev => {
      if (prev.includes(orderId)) {
        return prev.filter(id => id !== orderId);
      }
      return [...prev, orderId];
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === draftOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(draftOrders.map(order => order.id));
    }
  };

  const handleExpandOrder = (orderId) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const handleEditQuantity = (item, order) => {
    setSelectedItem({ ...item, orderId: order.id });
    setEditQuantity(item.quantity.toString());
    setEditDialogOpen(true);
  };

  const handleExcludeItem = (item, order) => {
    setSelectedItem({ ...item, orderId: order.id });
    setExcludeReason('manual_exclude');
    setExcludeNotes('');
    setExcludeDialogOpen(true);
  };

  const submitEditQuantity = async () => {
    try {
      const newQuantity = parseFloat(editQuantity);
      if (isNaN(newQuantity) || newQuantity < 0) {
        enqueueSnackbar('Введите корректное количество', { variant: 'warning' });
        return;
      }

      await axios.patch(`/api/procurement/orders/${selectedItem.orderId}/items/${selectedItem.id}`, {
        quantity: newQuantity
      });

      enqueueSnackbar('Количество обновлено', { variant: 'success' });
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      enqueueSnackbar('Ошибка обновления количества', { variant: 'error' });
    }
  };

  const submitExcludeItem = async () => {
    try {
      if (!excludeReason) {
        enqueueSnackbar('Выберите причину исключения', { variant: 'warning' });
        return;
      }

      await axios.post(`/api/procurement/overrides`, {
        order_item_id: selectedItem.order_item_id,
        reason: excludeReason,
        notes: excludeNotes
      });

      enqueueSnackbar('Позиция исключена из закупки', { variant: 'success' });
      setExcludeDialogOpen(false);
      fetchData();
    } catch (error) {
      enqueueSnackbar('Ошибка исключения позиции', { variant: 'error' });
    }
  };

  const handleSendOrders = async () => {
    try {
      const ordersToSend = selectedOrders.length > 0 
        ? selectedOrders 
        : draftOrders.map(o => o.id);

      if (ordersToSend.length === 0) {
        enqueueSnackbar('Нет заказов для отправки', { variant: 'warning' });
        return;
      }

      const confirmed = window.confirm(
        `Вы уверены, что хотите отправить ${ordersToSend.length} заказ(ов) поставщикам?`
      );

      if (!confirmed) return;

      await axios.post('/api/procurement/send-orders', {
        orderIds: ordersToSend
      });

      enqueueSnackbar('Заказы отправлены поставщикам', { variant: 'success' });
      setSelectedOrders([]);
      fetchData();
    } catch (error) {
      enqueueSnackbar('Ошибка отправки заказов', { variant: 'error' });
    }
  };

  const calculateOrderTotal = (items) => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getSupplierName = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier ? supplier.name : 'Неизвестный поставщик';
  };

  const getStatusChip = (status) => {
    const statusConfig = orderStatuses.find(s => s.value === status) || orderStatuses[0];
    return (
      <Chip 
        label={statusConfig.label} 
        color={statusConfig.color} 
        size="small"
      />
    );
  };

  const renderDraftOrders = () => (
    <Box>
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">
          Сформированные заказы ({draftOrders.length})
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedOrders.length > 0 && (
            <Typography variant="body2" color="primary">
              Выбрано: {selectedOrders.length}
            </Typography>
          )}
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSendOrders}
            disabled={draftOrders.length === 0}
          >
            Отправить {selectedOrders.length > 0 ? 'выбранные' : 'все'}
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={draftOrders.length > 0 && selectedOrders.length === draftOrders.length}
                  indeterminate={selectedOrders.length > 0 && selectedOrders.length < draftOrders.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell width={50}></TableCell>
              <TableCell>Поставщик</TableCell>
              <TableCell>Номер заказа</TableCell>
              <TableCell align="center">Позиций</TableCell>
              <TableCell align="right">Сумма</TableCell>
              <TableCell>Адрес доставки</TableCell>
              <TableCell>Дата создания</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {draftOrders.map((order) => (
              <React.Fragment key={order.id}>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => handleSelectOrder(order.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleExpandOrder(order.id)}
                    >
                      {expandedOrders[order.id] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>{getSupplierName(order.supplier_id)}</TableCell>
                  <TableCell>{order.order_number}</TableCell>
                  <TableCell align="center">
                    <Chip label={order.items.length} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    {calculateOrderTotal(order.items).toLocaleString('ru-RU')} ₽
                  </TableCell>
                  <TableCell>{order.delivery_address || 'Основной склад'}</TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Отправить заказ">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleSendOrders([order.id])}
                      >
                        <SendIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={9} sx={{ p: 0 }}>
                    <Collapse in={expandedOrders[order.id]} timeout="auto" unmountOnExit>
                      <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Позиции заказа:
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>SKU</TableCell>
                              <TableCell>Наименование</TableCell>
                              <TableCell align="center">Количество</TableCell>
                              <TableCell align="right">Цена</TableCell>
                              <TableCell align="right">Сумма</TableCell>
                              <TableCell align="center">Статус</TableCell>
                              <TableCell align="center">Действия</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {order.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.sku}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell align="center">
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => handleEditQuantity(item, order)}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    {item.quantity}
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  {item.price.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell align="right">
                                  {(item.price * item.quantity).toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell align="center">
                                  {item.procurement_status === 'excluded' ? (
                                    <Chip 
                                      label="Исключено" 
                                      color="error" 
                                      size="small"
                                      icon={<BlockIcon />}
                                    />
                                  ) : (
                                    <Chip 
                                      label="В заказе" 
                                      color="success" 
                                      size="small"
                                    />
                                  )}
                                </TableCell>
                                <TableCell align="center">
                                  <Tooltip title="Исключить из закупки">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => handleExcludeItem(item, order)}
                                      disabled={item.procurement_status === 'excluded'}
                                    >
                                      <RemoveIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
            {draftOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography variant="body2" color="textSecondary">
                    Нет сформированных заказов
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderOrderHistory = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Поиск"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Поставщик</InputLabel>
              <Select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                label="Поставщик"
              >
                <MenuItem value="">Все</MenuItem>
                {suppliers.map(supplier => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Статус"
              >
                <MenuItem value="">Все</MenuItem>
                {orderStatuses.map(status => (
                  <MenuItem key={status.value} value={status.value}>
                    {status.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ruLocale}>
              <DatePicker
                label="Дата от"
                value={dateFrom}
                onChange={setDateFrom}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
          <Grid item xs={12} md={2}>
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ruLocale}>
              <DatePicker
                label="Дата до"
                value={dateTo}
                onChange={setDateTo}
                renderInput={(params) => <TextField {...params} fullWidth />}
              />
            </LocalizationProvider>
          </Grid>
        </Grid>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Номер заказа</TableCell>
              <TableCell>Поставщик</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="center">Позиций</TableCell>
              <TableCell align="right">Сумма</TableCell>
              <TableCell>Дата создания</TableCell>
              <TableCell>Дата отправки</TableCell>
              <TableCell>Тип</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orderHistory.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.order_number}</TableCell>
                <TableCell>{getSupplierName(order.supplier_id)}</TableCell>
                <TableCell>{getStatusChip(order.status)}</TableCell>
                <TableCell align="center">{order.items_count}</TableCell>
                <TableCell align="right">
                  {order.total_amount.toLocaleString('ru-RU')} ₽
                </TableCell>
                <TableCell>
                  {format(new Date(order.created_at), 'dd.MM.yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  {order.sent_at ? format(new Date(order.sent_at), 'dd.MM.yyyy HH:mm') : '-'}
                </TableCell>
                <TableCell>
                  <Chip 
                    label={order.procurement_type === 'auto' ? 'Авто' : 'Ручная'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={-1}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => setRowsPerPage(parseInt(e.target.value, 10))}
          labelRowsPerPage="Строк на странице:"
        />
      </TableContainer>
    </Box>
  );

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Центр закупок
        </Typography>
        
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <InventoryIcon color="primary" />
                  <Box>
                    <Typography variant="h6">
                      {draftOrders.length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Черновиков заказов
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <AttachMoneyIcon color="success" />
                  <Box>
                    <Typography variant="h6">
                      {draftOrders.reduce((sum, order) => 
                        sum + calculateOrderTotal(order.items), 0
                      ).toLocaleString('ru-RU')} ₽
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Сумма к закупке
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <LocalShippingIcon color="info" />
                  <Box>
                    <Typography variant="h6">
                      {suppliers.filter(s => s.is_active).length}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Активных поставщиков
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <ScheduleIcon color="warning" />
                  <Box>
                    <Typography variant="h6">
                      Авто
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Следующая закупка через 2ч
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper sx={{ width: '100%' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="Сформированные заказы" />
            <Tab label="История закупок" />
          </Tabs>
          <Box sx={{ p: 3 }}>
            {loading ? (
              <Typography>Загрузка...</Typography>
            ) : (
              activeTab === 0 ? renderDraftOrders() : renderOrderHistory()
            )}
          </Box>
        </Paper>
      </Box>

      {/* Диалог редактирования количества */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Изменить количество</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Количество"
            type="number"
            value={editQuantity}
            onChange={(e) => setEditQuantity(e.target.value)}
            sx={{ mt: 2 }}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Отмена</Button>
          <Button onClick={submitEditQuantity} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог исключения из закупки */}
      <Dialog open={excludeDialogOpen} onClose={() => setExcludeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Исключить позицию из закупки</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Позиция будет исключена из текущей закупки, но останется в заказе покупателя
          </Alert>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Причина исключения</InputLabel>
            <Select
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
              label="Причина исключения"
            >
              {excludeReasons.map(reason => (
                <MenuItem key={reason.value} value={reason.value}>
                  {reason.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Примечания"
            multiline
            rows={3}
            value={excludeNotes}
            onChange={(e) => setExcludeNotes(e.target.value)}
            helperText="Дополнительная информация (необязательно)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcludeDialogOpen(false)}>Отмена</Button>
          <Button onClick={submitExcludeItem} variant="contained" color="error">
            Исключить
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProcurementCenter;
